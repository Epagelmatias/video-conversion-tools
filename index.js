const ffmpeg = require("fluent-ffmpeg");
const { promisify } = require("util");
const { exec } = require("child_process");
const fs = require("fs").promises;
const commander = require("commander");
const ffmpegStatic = require("ffmpeg-static");

const ffprobe = promisify(ffmpeg.ffprobe);
const execAsync = promisify(exec);

ffmpeg.setFfmpegPath(ffmpegStatic);

const program = new commander.Command();

program
  .option("-sg, --segs <value>", "Number of segments", 15)
  .option("-sc, --secs <value>", "Duration of each segment in seconds", 6)
  .parse(process.argv);

const options = program.opts();

console.log("Options:", options);

// Input and output file paths
const inputFilePath = "input.mp4";
const outputFilePath = "output.mp4";

const segmentsNum = parseInt(options.segs)+1
const segmentsSec = parseInt(options.secs)

// Function to create command for segment extraction
const createSegmentCommand = (startOffset, duration, outputPath) => {
  return new Promise((resolve, reject) => {
    ffmpeg(inputFilePath)
      .setStartTime(startOffset)
      .duration(duration)
      .output(outputPath)
      .videoCodec("copy")
      .audioCodec("copy")
      .on("end", resolve)
      .on("error", reject)
      .run();
  });
};

// Function to get video duration using ffprobe

// Main function using async/await
const main = async () => {
  try {
    const metadata = await ffprobe(inputFilePath)
    const videoDuration = Math.floor(metadata.format.duration)

    let starts = [];
    let inputFiles = [];

    for (let i = 1; i < segmentsNum; i++) {
      let start
      if(i==1){
        start = 60
      }else if (i == segmentsNum-1){
        start = videoDuration - 60
      }else{
        start = Math.floor((i / segmentsNum) * videoDuration);
      }
        starts.push(start);
    }

    for (const start of starts) {
      const fileName = start + ".mp4";
      await createSegmentCommand(start, segmentsSec, fileName);
      inputFiles.push(fileName);
    }
    
    // Create a temporary file list
    const fileListPath = "filelist.txt";
    const fileContent = inputFiles.map((file) => `file '${file}'`).join("\n");
    await fs.writeFile(fileListPath, fileContent);

    const createCustomCommand = (fileListPath, outputFilePath) => {
      return new Promise((resolve, reject) => {
        ffmpeg()
          .input(fileListPath)
          .inputFormat("concat")
          .inputOptions(["-safe 0"])
          .output(outputFilePath)
          .outputOptions(["-c copy"])
          .on("end", resolve)
          .on("error", reject)
          .run();
      });
    };

    await createCustomCommand(fileListPath, outputFilePath);

    // const metadata2 = await ffprobe("h 24.mp4");
    // console.log("output meta", metadata2.format);

    // Create a command to concatenate videos
    // const command = `ffmpeg -y -f concat -safe 0 -i "${fileListPath}" -c copy "${outputFilePath}"`;

    // Execute the FFmpeg command
    // await execAsync(command);

    // Delete temporary files
    await Promise.all(inputFiles.map((file) => fs.unlink(file)));

    

    console.log("Temporary files deleted.");
    console.log("Videos merged successfully.");
  } catch (error) {
    console.error("Error:", error.message);
  }
};

// Run the main function
main();

import { Client, VisionClient, createRobotClient, 
StreamClient, commonApi } from '@viamrobotics/sdk';
import type { ResourceName, Constraints, Pose } from '@viamrobotics/sdk';
import * as SDK from '@viamrobotics/sdk';
import { ImageCapture } from 'image-capture';

// globals
const robotLocation = process.env.ROBOT_LOCATION
const robotKey = process.env.ROBOT_KEY
const robotKeyId = process.env.ROBOT_KEY_ID

async function connect() {
  const credential = {
    payload: robotKey,
    type: 'api-key',
  };

  // This is the host address of the main part of your robot.
  const host = robotLocation;

  return createRobotClient({
    host,
    credential,
    authEntity: robotKeyId,
    signalingAddress: 'https://app.viam.com:443'
  });
}


function convertDataURIToBinary(dataURI) {
  var BASE64_MARKER = ';base64,';
  var base64Index = dataURI.indexOf(BASE64_MARKER) + BASE64_MARKER.length;
  var base64 = dataURI.substring(base64Index);
  var raw = window.atob(base64);
  var rawLength = raw.length;
  var array = new Uint8Array(new ArrayBuffer(rawLength));

  for(let i = 0; i < rawLength; i++) {
    array[i] = raw.charCodeAt(i);
  }
  return array;
}

async function main() {
  // Connect to client
  let client: Client;  
  try {
    client = await connect();
    console.log('connected!');
  } catch (error) {
    console.log(error);
    return;
  }
  const detector = new VisionClient(client, 'coco-detector');

  let camera_button = document.querySelector("#start-camera");
  let video = document.querySelector("#video");
  let click_button = document.querySelector("#click-photo");
  let canvas = document.querySelector("#canvas");
  let finalCanvas = document.querySelector("#finalCanvas");
  let image = document.querySelector("#image");
  let captureDevice;

  let video_constraints = {
    width: {min: 200, max: 1000},
    height: { min: 200, max: 800}, 
  };
  let mstream = await navigator.mediaDevices.getUserMedia({ video: video_constraints, audio: false });
  console.log("got media stream")
  captureDevice = new ImageCapture(mstream.getVideoTracks()[0]);
  
  click_button.addEventListener('click', async function() {
    while(true) {
      let img = await captureDevice.takePhoto()
      let bImage = await createImageBitmap(img, {resizeWidth: 640, resizeHeight: 480})
      var ctx = canvas.getContext("2d");
      var destCtx = finalCanvas.getContext('2d')
      ctx.strokeStyle = "#aa0000";
      ctx.fillStyle = "#aa0000";
      ctx.font = "14px Arial"
      ctx.drawImage(bImage, 0, 0);

      var imgData = canvas.toDataURL('image/jpeg')
      let det = await detector.getDetections(convertDataURIToBinary(imgData), 640, 480, 'image/jpeg')
      det.forEach((d) => {
        if (d.confidence > .6) {
        ctx.strokeRect(d.xMin, d.yMin, d.xMax - d.xMin, d.yMax - d.yMin)
        ctx.fillText(`${d.className} ${d.confidence}`, d.xMin + 5, d.yMin - 10);
        }
      })

      destCtx.drawImage(canvas,0,0)
    }
  });
}

main();


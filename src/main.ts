import { Client, VisionClient, createRobotClient, genericApi, SensorClient } from '@viamrobotics/sdk';
import { SpeechClient } from 'speech-service-api'
import { ImageCapture } from 'image-capture';
import play from 'audio-play';
import decode, {decoders} from 'audio-decode';
import { MediaRecorder, register } from 'extendable-media-recorder';
import { connect } from 'extendable-media-recorder-wav-encoder';
import { ChatClient } from 'chat-service-api';

// globals
const robotLocation = process.env.ROBOT_LOCATION
const robotKey = process.env.ROBOT_KEY
const robotKeyId = process.env.ROBOT_KEY_ID

async function viam_connect() {
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
    client = await viam_connect();
    console.log('connected!');
  } catch (error) {
    console.log(error);
    return;
  }
  await register(await connect());

  let detector_button = document.querySelector("#click-photo");
  let detector_select = document.querySelector("#detector-select");
  let detector_code = { 
    "coco-detector" : document.querySelector("#coco-detector-code"),
    "red-detector" : document.querySelector("#red-detector-code"),
    "face-detector" : document.querySelector("#face-detector-code")
  };
  let detector_desc = { 
    "coco-detector" : document.querySelector("#coco-detector-desc"),
    "red-detector" : document.querySelector("#red-detector-desc"),
    "face-detector" : document.querySelector("#face-detector-desc")
  };
  let tempCanvas = document.querySelector("#canvas");
  let finalCanvas = document.querySelector("#finalCanvas");
  let vlmCanvas = document.querySelector("#VLMImage");

  let system_table = document.querySelector("#system_table");

  let home_select = document.querySelector("#home_select");
  let system_select = document.querySelector("#system_select");
  let object_select = document.querySelector("#object_select");
  let gesture_select = document.querySelector("#gesture_select");
  let vlm_select = document.querySelector("#vlm_select");
  let vlm_question = document.querySelector("#vlm_question");
  let vlm_completion = document.querySelector("#vlm_completion");
  let more_select = document.querySelector("#more_select");
  let nav_selectors = [home_select, system_select, object_select, gesture_select, vlm_select, more_select]

  let asl_words = document.querySelector("#asl_words");
  let asl_completion = document.querySelector("#asl_completion");

  let captureForVLM = document.querySelector('#captureForVLM');
  let vlmImages = {
    'dog': document.querySelector('#vlm_dog'),
    'bread': document.querySelector('#vlm_bread'),
    'car': document.querySelector('#vlm_car'),
    'balance': document.querySelector('#vlm_balance'),
    'flowers': document.querySelector('#vlm_flowers'),
    'party': document.querySelector('#vlm_party'),
  }
  let vlmRecordQuestion = document.querySelector('#vlmRecordQuestion');

  let captureDevice;
  let vstream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
  let astream = await navigator.mediaDevices.getUserMedia({ video: false, audio: true });

  console.log("got media stream")
  captureDevice = new ImageCapture(vstream.getVideoTracks()[0]);
  const mediaRecorder = new MediaRecorder(astream, { mimeType: 'audio/wav' });
  let audioChunks = [];

  const system_monitor = new SensorClient(client, 'telegraf');
  const speech = new SpeechClient(client, "speechio");
  const asl_detector = new VisionClient(client, "asl_detector");
  const vlm_classifier = new VisionClient(client, "moondream-vision");
  const llm = new ChatClient(client, "llm");

  mediaRecorder.addEventListener('dataavailable', event => {
    audioChunks.push(event.data);
    console.log("recording ended")
  });

  mediaRecorder.onstop = async (e) => {
    const blob = new Blob(audioChunks, { type: mediaRecorder.mimeType });
    audioChunks = [];
    
    // uncomment below for testing
    //const audio = new Audio();
    //audio.src = URL.createObjectURL(blob);
    //audio.play();
    const speechText = await speech.toText(new Uint8Array(await new Response(blob).arrayBuffer()), "wav")
    vlm_question.innerHTML = speechText;
    vlm_completion.innerHTML = "Please wait... this can take some time."
    let classifications = await vlm_classifier.getClassifications(getImage(vlmCanvas), 300, 280, 'image/jpeg', 1, {"question": speechText});
    vlm_completion.innerHTML = classifications[0].className;
    vlmRecordQuestion?.classList.remove("pure-button-disabled");
  };

  vlmRecordQuestion?.addEventListener("mousedown", () => {
    mediaRecorder.start();
    vlm_question.innerHTML = "Please wait...";
    vlm_completion.innerHTML = "";
  });

  vlmRecordQuestion?.addEventListener("mouseup", async () => {
    vlmRecordQuestion?.classList.add("pure-button-disabled");
    await mediaRecorder.stop();
  });

  let running = {
    'home' : false,
    'system': false,
    'object': false,
    'gesture': false,
    'vlm': false,
    'more': false  
  };


  for (let vlmImg in vlmImages) {
    vlmImages[vlmImg].addEventListener("click", () => {
      var context = vlmCanvas.getContext('2d');
      context.drawImage(vlmImages[vlmImg], 0, 0, 280, 220);
      vlmRecordQuestion?.classList.remove("pure-button-disabled");
    })
  }

  nav_selectors.forEach(function(sel_elem) {
    sel_elem.classList.remove('pure-menu-selected')

    sel_elem.addEventListener("click", function() {
      for (const elem in nav_selectors) {
        let elem_prefix = nav_selectors[elem].id.split('_')[0]
        let elem_content = document.getElementById(`${elem_prefix}_content`);
        if (sel_elem.id == nav_selectors[elem].id) {
          running[elem_prefix] = true;
          nav_selectors[elem].classList.add('pure-menu-selected');
          elem_content.style.display = "block";
          run(elem_prefix);
        } else {
          running[elem_prefix] = false;
          nav_selectors[elem].classList.remove('pure-menu-selected')
          elem_content.style.display = "none"
        }
      }
    });
});

  async function run(type) {
    if (type == 'system') {
      let display_stats = {}
      while(running['system']) {
        const stats = await system_monitor.getReadings();
        system_table.innerHTML = "";
        let row = system_table.insertRow();
        let cell = row.insertCell();
        let text = document.createTextNode("CPU Usage");
        cell.appendChild(text);
        let cell2 = row.insertCell();
        if (stats.cpu && stats.cpu.fields) {
          display_stats['cpu'] = (100 - stats.cpu.fields.usage_idle).toFixed(2);
        }
        let text2 = document.createTextNode(display_stats['cpu'] + '%');
        cell2.appendChild(text2);

        row = system_table.insertRow();
        cell = row.insertCell();
        text = document.createTextNode("System Load");
        cell.appendChild(text);
        cell2 = row.insertCell();
        if (stats.system && stats.system.fields) {
          display_stats['load1'] = stats.system.fields.load1.toFixed(2);
        }
        text2 = document.createTextNode(display_stats['load1']);
        cell2.appendChild(text2);

        row = system_table.insertRow();
        cell = row.insertCell();
        text = document.createTextNode("Memory Usage");
        cell.appendChild(text);
        cell2 = row.insertCell();
        if (stats.mem && stats.mem.fields) {
          display_stats['mem_used'] = stats.mem.fields.used_percent.toFixed(2);
        }
        text2 = document.createTextNode(display_stats['mem_used'] + '%');
        cell2.appendChild(text2);

        row = system_table.insertRow();
        cell = row.insertCell();
        text = document.createTextNode("Processes Running");
        cell.appendChild(text);
        cell2 = row.insertCell();
        if (stats.processes && stats.processes.fields) {
          display_stats['proc_running'] = stats.processes.fields.running;
        }
        text2 = document.createTextNode(display_stats['proc_running']);
        cell2.appendChild(text2);

        row = system_table.insertRow();
        cell = row.insertCell();
        text = document.createTextNode("Processes Sleeping");
        cell.appendChild(text);
        cell2 = row.insertCell();
        if (stats.processes && stats.processes.fields) {
          display_stats['proc_sleeping'] = stats.processes.fields.sleeping;
        }
        text2 = document.createTextNode(display_stats['proc_sleeping']);
        cell2.appendChild(text2);

        row = system_table.insertRow();
        cell = row.insertCell();
        text = document.createTextNode("Disk reads");
        cell.appendChild(text);
        cell2 = row.insertCell();
        if (stats.diskio && stats.diskio.fields) {
          display_stats['disk_reads'] = stats.diskio.fields.reads;
        } else if (stats.diskio && stats.diskio.sda && stats.diskio.sda.fields) {
          display_stats['disk_reads'] = stats.diskio.sda.fields.reads;
        }
        text2 = document.createTextNode(display_stats['disk_reads']);
        cell2.appendChild(text2);

        row = system_table.insertRow();
        cell = row.insertCell();
        text = document.createTextNode("Disk writes");
        cell.appendChild(text);
        cell2 = row.insertCell();
        if (stats.diskio && stats.diskio.fields) {
          display_stats['disk_writes'] = stats.diskio.fields.writes;
        } else if (stats.diskio && stats.diskio.sda && stats.diskio.sda.fields) {
          display_stats['disk_writes'] = stats.diskio.sda.fields.writes;
        }
        text2 = document.createTextNode(display_stats['disk_writes']);
        cell2.appendChild(text2);

        row = system_table.insertRow();
        cell = row.insertCell();
        text = document.createTextNode("Disk used percent");
        cell.appendChild(text);
        cell2 = row.insertCell();
        if (stats.disk && stats.disk.fields) {
          display_stats['disk_percent'] = stats.disk.fields.used_percent.toFixed(2);
        }
        text2 = document.createTextNode(display_stats['disk_percent'] + '%');
        cell2.appendChild(text2);

        row = system_table.insertRow();
        cell = row.insertCell();
        text = document.createTextNode("TCP conn established");
        cell.appendChild(text);
        cell2 = row.insertCell();
        if (stats.netstat && stats.netstat.fields) {
          display_stats['tcp_established'] = stats.netstat.fields.tcp_established;
        }
        text2 = document.createTextNode(display_stats['tcp_established']);
        cell2.appendChild(text2);

        row = system_table.insertRow();
        cell = row.insertCell();
        text = document.createTextNode("System Uptime");
        cell.appendChild(text);
        cell2 = row.insertCell();
        if (stats.system && stats.system.fields) {
          display_stats['system_uptime'] = stats.system.fields.uptime_format;
        }
        text2 = document.createTextNode(display_stats['system_uptime']);
        cell2.appendChild(text2);

        await new Promise(r => setTimeout(r, 100));
      }
    } else if (type == "gesture") {
      asl_words.innerHTML = "";
      asl_completion.innerHTML = "";

      while(running['gesture']) {
        let completed = false;
        let last_seen = "";
        let letters = "";

        while (!completed) {
          let img = await captureImage(300,280);
          let detections = await asl_detector.getDetections(img.image, 300, 280, 'image/jpeg');
          if (detections[0] && detections[0].confidence > .7) {
            if (detections[0].className == 'V' && last_seen == 'V') {
              let chat_prefix = "Make up an acronym from only the letters ";
              letters = letters.substring(0, letters.length - 1);
              asl_words.innerHTML = letters;
              asl_completion.innerHTML = "Please wait...";
              let completion = await llm.chat(chat_prefix + letters);
              letters = "";
              asl_completion.innerHTML = completion;
              completed = true;
            }
            else {
              last_seen = detections[0].className;
              letters = letters + detections[0].className;
              asl_words.innerHTML = letters;
              await new Promise(r => setTimeout(r, 500));
            }
          }
        }
      }
    }
  }

  async function captureImage(width, height) {
    let img = await captureDevice.takePhoto();
    let bImage = await createImageBitmap(img, {resizeWidth: width, resizeHeight: height})
    var ctx = tempCanvas.getContext("2d");
    ctx.strokeStyle = "#aa0000";
    ctx.fillStyle = "#aa0000";
    ctx.font = "14px Arial";
    ctx.drawImage(bImage, 0, 0);

    return { image: getImage(tempCanvas), ctx: ctx };
  }

  function getImage(selectedCanvas) {
    var imgData = selectedCanvas.toDataURL('image/jpeg');
    return convertDataURIToBinary(imgData);
  }

  captureForVLM.addEventListener('click', async () =>
  {
    await captureImage(280, 220);
    var destCtx = vlmCanvas.getContext('2d');
    destCtx.drawImage(tempCanvas,0,0);
    vlmRecordQuestion?.classList.remove("pure-button-disabled");
  });

  detector_button.addEventListener('click', async () => {
    running['object'] = false;
    const detector = new VisionClient(client, detector_select.value);

    for (const [key, value] of Object.entries(detector_code)) {
      if (detector_select.value == key) {
        detector_code[key].style.display = 'block';
        detector_desc[key].style.display = 'block';
      } else {
        detector_code[key].style.display = 'none';
        detector_desc[key].style.display = 'none';
      }
    }

    // wait a bit to ensure previous running loop stops
    await new Promise(r => setTimeout(r, 500));
    running['object'] = true;

    let seen_classes = {};

    while(running['object']) {
      let img = await captureImage(300,280);
      let det = await detector.getDetections(img.image, 300, 280, 'image/jpeg')
      det.forEach( async (d) => {
        if (d.confidence > .6) {
          if (!seen_classes[d.className]) {
            seen_classes[d.className] = true;
            let sp = await speech.toSpeech("I see a " + d.className);
            const audioBuffer = await decoders.mp3(sp); // decode
            play(audioBuffer);
          }
          img.ctx.strokeRect(d.xMin, d.yMin, d.xMax - d.xMin, d.yMax - d.yMin)
          img.ctx.fillText(`${d.className} ${d.confidence.toFixed(2)}`, d.xMin + 5, d.yMin - 10);
        }
      })
      var destCtx = finalCanvas.getContext('2d')
      destCtx.drawImage(tempCanvas,0,0)
    }
  });
}

main();


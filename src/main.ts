import { Client, VisionClient, createRobotClient, genericApi, SensorClient } from '@viamrobotics/sdk';
import { SpeechClient } from 'speech-service-api'
import { ImageCapture } from 'image-capture';
import play from 'audio-play';
import decode, {decoders} from 'audio-decode';
import { ChatClient } from 'chat-service-api';

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

  let detector_button = document.querySelector("#click-photo");
  let detector_select = document.querySelector("#detector-select");
  let canvas = document.querySelector("#canvas");
  let finalCanvas = document.querySelector("#finalCanvas");

  let system_table = document.querySelector("#system_table");

  let home_select = document.querySelector("#home_select");
  let system_select = document.querySelector("#system_select");
  let object_select = document.querySelector("#object_select");
  let gesture_select = document.querySelector("#gesture_select");
  let vlm_select = document.querySelector("#vlm_select");
  let more_select = document.querySelector("#more_select");
  let nav_selectors = [home_select, system_select, object_select, gesture_select, vlm_select, more_select]

  let captureDevice;
  let mstream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
  console.log("got media stream")
  captureDevice = new ImageCapture(mstream.getVideoTracks()[0]);
  
  let running = {
    'home' : false,
    'system': false,
    'object': false,
    'gesture': false,
    'vlm': false,
    'more': false  
  };


  nav_selectors.forEach(function(sel_elem) {
    sel_elem.classList.remove('pure-menu-selected')

    sel_elem.addEventListener("click", function() {
      nav_selectors.forEach(function(elem) {
        let elem_prefix = elem.id.split('_')[0]
        let elem_content = document.getElementById(`${elem_prefix}_content`);
        if (sel_elem.id == elem.id) {
          running[elem_prefix] = true;
          elem.classList.add('pure-menu-selected');
          elem_content.style.display = "block";
          run(elem_prefix);
        } else {
          running[elem_prefix] = false;
          elem.classList.remove('pure-menu-selected')
          elem_content.style.display = "none"
        }
      });
    });
});

  const system_monitor = new SensorClient(client, 'telegraf');

  async function run(type) {
    if (type == 'system') {
      let display_stats = {}
      while(running['system']) {
        const stats = await system_monitor.getReadings();
        console.log(stats)
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
    }
  }

  detector_button.addEventListener('click', async function() {
    running['object'] = false;
    const detector = new VisionClient(client, detector_select.value);
    // wait a bit to ensure previous running loop stops
    await new Promise(r => setTimeout(r, 500));
    running['object'] = true;

    const speech = new SpeechClient(client, "speechio");
    let sp = await speech.toSpeech(detector_select.options[detector_select.selectedIndex].text)
    const audioBuffer = await decoders.mp3(sp); // decode
    play(audioBuffer)

    const llm = new ChatClient(client, "llm");
    let completion = await llm.chat("Write a scary story about apple, letter L, peanut butter, cars");
    console.log(completion)


    while(running['object']) {
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
        ctx.fillText(`${d.className} ${d.confidence.toFixed(2)}`, d.xMin + 5, d.yMin - 10);
        }
      })

      destCtx.drawImage(canvas,0,0)
    }
  });
}

main();


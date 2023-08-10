// Keep reference to original functions
let _error = window.console.error;
let _warn = window.console.warn;
const singleEndpoint = "https://api.flusk.eu/api:monitor/webhook-front-end-errors";
const bulkEndpoint = "https://api.flusk.eu/api:monitor/webhook-front-end-errors-on-load";
const WSURL = "wss://monitor-v1.flusk.eu";
let ip;
let lastScreenshotTime = 0;
const screenshotInterval = 5000;
let device; //Can be tablet, phone, or computer


let sendBulkErrorsToXano = function(){


    let currentAppId = window.app._id;

    let data = {
        app_id: currentAppId,
        errors: cleanErrors
    }

    sendToXano(data, bulkEndpoint);

}

function loadScript(src) {
    return new Promise((resolve, reject) => {
        const script = document.createElement("script");
        script.src = src;
        script.onload = resolve;
        script.onerror = reject;
        document.head.appendChild(script);
    });
}

async function loadHtml2Canvas() {
    if (typeof html2canvas !== "undefined") {
        return;
    }

    try {
        await loadScript("https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js");
    } catch (error) {
        console.error("Failed to load html2canvas library:", error);
    }
}
loadHtml2Canvas();

function stringify(obj) {
    let cache = [];
    let str = JSON.stringify(obj, function(key, value) {
        if (typeof value === "object" && value !== null) {
            if (cache.indexOf(value) !== -1) {
                return;
            }
            cache.push(value);
        }
        return value;
    });
    cache = null;
    return str;
}

let sendToXano = function(data, endpoint) {
    try {
        let res = fetch(endpoint, {
            method: 'POST',
            headers: {
                'Accept': 'application/json',
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(data)
        });
        console.log("Flusk Monitor is processing this error for criticality analyzing...");
    } catch (e) {
        console.log("An error appeared analyzing this log. Please contact Flusk at https://flusk.eu/contact");
    }
};



// DISABLED BECAUSE IT SEEMS TO CAUSE LAGS ON PAGE LOAD

window.console.error = async function () {
    let now = new Date().getTime();

    // Throttle the screenshot capturing
    if (now - lastScreenshotTime < screenshotInterval) {
        _error.apply(this, arguments);
        return;
    }

    lastScreenshotTime = now;

    let screenshot;
    let message = arguments[0]
    let currentAppId = window.app._id;
    let version = window.app.app_version;
    let userUID = window.bubble_session_uid;
    let url = window.location.href;
    let page_name = window.bubble_page_name;

    if (document.readyState === "complete") {
        screenshot = await takeScreenshot();

        let data = {
            "app_id": currentAppId,
            "message": message,
            "screenshot": screenshot,
            "version": version,
            "user_uid":userUID,
            "url": url,
            "page_name": page_name,
            "timestamp": now,
            "device": device
        };
        sendToXano(data, singleEndpoint);
    }

    _error.apply(this, arguments);
};


/*
// Wrap window.onunhandledrejection with try-catch
let originalWindowOnUnhandledRejection = window.onunhandledrejection;
window.onunhandledrejection = async function (event) {
  try {
    console.log("UR caught");
    const now = new Date().getTime();
    let screenshot = await takeScreenshot();
    sendToXano("wait Victor", screenshot, now);
    if (originalWindowOnUnhandledRejection) {
      originalWindowOnUnhandledRejection(event);
    }
  } catch (e) {
    console.log("Error in onunhandledrejection handler:", e);
  }
};
*/

let takeScreenshot = async function() {
    let now = new Date().getTime();
    await loadHtml2Canvas();

    const element = document.body;
    let canvas = await html2canvas(element);

    // Resize the canvas to reduce image quality/size
    const ctx = canvas.getContext('2d');
    const scaledCanvas = document.createElement('canvas');
    scaledCanvas.width = canvas.width * 0.5; // scale by 50%
    scaledCanvas.height = canvas.height * 0.5;
    scaledCanvas.getContext('2d').drawImage(canvas, 0, 0, scaledCanvas.width, scaledCanvas.height);

    const screenshotDataURL = scaledCanvas.toDataURL('image/png');

    let now2 = new Date().getTime();
    console.log((now2-now)/1000);

    return screenshotDataURL;
};

let getIP = async function(){
    try{
        let URL = "https://ipv4.geojs.io/v1/ip/geo.json";
        let res = await fetch(URL);
        let data = await res.json();
        ip = data;
    }catch(e){
        console.error("Flusk Monitor - Failed to fetch IP from Current User.");
    }
}

getIP();

//WEBSOCKET SECTION
const socket = new WebSocket(WSURL);

socket.onopen = () => {
    console.info('Flusk Monitor error logger connected.??!!??!!');
};

socket.onmessage = (event) => {
    const message = event.data;
    if (message.includes("hello")) {
        let app_id = window.app._id;
        let version = window.app.app_version;
        let userUID = window.bubble_session_uid;
        let url = window.location.href;
        let page_name = window.bubble_page_name;
        let data = {
            app_id: app_id,
            version:version,
            message: "Hi",
            user_uid: userUID,
            url: url,
            page_name: page_name,
            device: device,
            code: 200,
            ip: ip
        };
        socket.send(JSON.stringify(data));
    }
};

socket.onclose = (event) => {
    console.error("Flusk Activity Logger was closed for unexpected reasons.");
};

let checkDevice = function(){
    const ua = navigator.userAgent;

    if (/tablet|ipad|playbook|silk/i.test(ua)) {
        return "tablet";
    }

    if (/mobile|iphone|ipod|android|blackberry|mini|windows\sce|palm/i.test(ua)) {
        return "phone";
    }

    return "computer";
}

device = checkDevice();
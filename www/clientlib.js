var RTCPeerConnection = null;
var getUserMedia = null;
var attachMediaStream = null;
var reattachMediaStream = null;
var webrtcDetectedBrowser = null;

var room = null;
var initiator;

var localStream;
var remoteStream;

var pc = null;
var signalingURL;

var localVideo;
var remoteVideo;

var channelReady;
var channel;

// setup Config.

var pc_config = {
  "iceServers":[
  {url: 'stun.sipgate.net'},
  {url: 'stun:stun.l.google.com:19302'},
  {url: 'stun:stun01.sipphone.com'},
  {url: 'stun:stun.ekiga.net'},
  {url: 'stun:stun.fwdnet.net'},
  {url: 'stun:stun.ideasip.com'},
  {url: 'stun:stun.iptel.org'},
  {url: 'stun:stun.rixtelecom.se'},
  {url: 'stun:stun.schlund.de'},
  {url: 'stun:stunserver.org'},
  {url: 'stun:stun.softjoys.com'},
  {url: 'stun:stun.voiparound.com'},
  {url: 'stun:stun.voipbuster.com'},
  {url: 'stun:stun.voipstunt.com'},
  {url: 'stun:stun.voxgratia.org'},
  {url: 'stun:stun.xten.com'}
  ]
}

var sdpConstraints = {'mandatory': {'OfferToReceiveAudio': true, 
'OfferToReceiveVideo': true} };
        
function initMyWebClient(sURL, lv, rv) {
  signalingURL = sURL;
  localVideo = lv;
  remoteVideo = rv;
  initWebRTCAdapter();
  openChannel();
}

function openChannel() {
  channelReady = false;
  channel = new WebSocket(signalingURL);
  channel.onopen = onChannelOpened;
  channel.onmessage = onChannelMessage;
  channel.onclose  = onChannelClosed;
};

function onChannelOpened() {
  channelReady = true;
  
  if(location.search.substring(1, 5) == 'room') {
    room = location.search.substring(6);
    sendMessage({"type": "ENTERROOM", "value": room * 1})
    initiator = true;
  } else {
    sendMessage({"type" : "GETROOM", "value": ""})
    initiator = false;
  }
  doGetUserMedia();
}

function onChannelMessage(message) {
  // expect json from server.
  processSignalingMessage(message.data)
}

function onChannelClosed() { channelReady = false; }

function sendMessage(message) {
  var msgString = JSON.stringify(message);
  channel.send(msgString);
}

function processSignalingMessage(message) {
  var msg = JSON.parse(message)
  if (msg.type === 'offer') {
    pc.setRemoteDescription(new RTCSessionDescription(msg));
    doAnswer();
  } else if (msg.type === 'answer') {
    pc.setRemoteDescription( new RTCSessionDescription(msg))
  } else if (msg.type === 'candidate') {
    var candidate = new RTCIceCandidate( {sdpMLineIndex:mix.label, candidate:msg.candidate} );
    pc.addIceCandidate(candidate) 
  } else if (msg.type === 'GETROOM') {
    room = msg.value;
    OnRoomReceived(room);
  } else if (msg.type === 'WRONGROOM') {
    window.location.href = '/'
  }
}

 function doGetUserMedia() {
        var constraints = {"audio": true, "video": {"mandatory": {}, "optional": []}};
        try {
            getUserMedia(constraints, onUserMediaSuccess,
                function(e) {
                        console.log("getUserMedia error "+ e.toString());
                });
        } catch (e) {
            console.log(e.toString());
        }
    };

function ____doGetUserMedia() {
  var constraints = { "audio" : true, "video": { "mandatory" : {} ,"optional" : [] }};

  try {
      getUserMedia(constraints, onUserMediaSuccess, null);
    } catch(e) {
      // do nada
  }
}

function onUserMediaSuccess(stream) {
  attachMediaStream(localVideo, stream);
  localStream = stream;
  createPeerConnection();
  pc.addStream(localStream);

  if (initiator) doCall();
};

function createPeerConnection() {
  var pc_contraints = {"optional": [{"DtlsSrtpKeyAgreement": true}]};
  try {
    pc = new RTCPeerConnection(pc_config, pc_constraints);
    pc.onicecandidate = onIceCandidate;
  } catch (e) {
    pc = null;
    return;
  }
  pc.onaddstream    = onRemoteStreamAdded;
};

function onIceCandidate(event) {
  if (event.candidate) {
    sendMessage({type: 'candidate',
      label: event.candidate.sdpMLineIndex,
      id: event.candidate.sdpMid,
      candidate: event.candidate.candidate });
  }
};

function onRemoteStreamAdded(event) {
    attachMediaStream(remoteVideo, event.stream);
    remoteStream = event.stream;
}

function doCall() {
  var constraints = { "optional": [], "mandatory": { "MozDontOfferDataChannel": true }};
  if (webrtcDetectedBrowser === 'chrome')
    for(var prop in constraints.mandatory) if (prop.indexOf("Moz") != -1) delete constraints.mandatory[prop];
    constraints = mergeConstraints(constraints, sdpConstraints);
    pc.createOffer(setLocalAndSendMessage, errorCallback, constraints)

}

function doAnswer() {
  pc.createAnswer(setLocalAndSendMessage, errorCallback, sdpConstraints)
}

function errorCallback (e) {
  console.log("Something is wrong: " + e.toString());
}

function setLocalAndSendMessage(sessionDescription) {
  pc.setLocalDescription(sessionDescription)
  sendMessage(sessionDescription);
}

function mergeConstraints(obj1, obj2) {
  var merged = obj1;
  for (var name in obj2.mandatory) merged.mandatory[name] = obj2.mandatory[name];
    merged.optional.concat(obj2.optional)
    return merged;
};
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
  "iceServers":[{url: 'stun:23.21.150.121'}, {url: 'stun:stun.l.google.com:19302'}]
}

var sdpConstraints = {'mandatory': {'OfferToReceiveAudio': true, 'OfferToReceiveVideo': true} };

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
  channel.onclosed  = onChannelClosed;
};

function onChannelOpened() {
  channelReady = true;
  if(location.search.substring(1, 5) == 'room') {
    sendMessage({"type": "ENTERROOM", "value": room * 1})
    initiator = true;
  } else {
    sendMessage({"type":"GETROOM", "value": ""})
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
    pc.setRemotDescription(new RTCSessionDescription(msg));
    doAnswer();
  } else if (msg.type === 'answer') {
    pc.setRemotDescription( new RTCSessionDescription(msg))
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
  var constraints = {
    "audio" : true,
    "video": { "mandatory" : {} },
    "optional" : [] 
  }

  try {
      getUserMedia(constraints, onUserMediaSuccess, null);
    } catch(e) {
      // do nada
  }
}

function onUserMediaSuccess() {
  attachMediaStream(localVid, stream);
  localStream = stream;
  createPeerConnection();
  pc.addStream(localStream)
  if (initiator) doCall();
}

function createPeerConnection() {
  var pc_contraints = {"optional": [{"DtlsSrtpKeyAgreement": true}]}
  try {
    pc = new RTCPeerConnection(pc_config, pc_constraints);
    pc.onicecandidate = onIceCandidate;
    pc.onaddstream    = onRemoteStreamAdded;
  } catch (e) {
    pc = null;
    return;
  }
};

function onIceCandidate(event) {
  if(event.candidate) {
    sendMessage({type: 'candidate',
      label: event.candidate.sdpMLineIndex,
      id: event.candidate.sdpMid,
      candidate: event.candidate.candidate })
  }
}

function onRemoteStreamAdded(event) {
    attachMediaStream(remoteVideo, event.stream);
    remoteStream = event.stream;
}

function doCall() {
  var constraints = { 
    "optional": [], "mandatory": { "MozDontOfferDataChannel": true }
  }
  if (webrtcDetectedBrowser === 'chrome')
    for(var prop in constraints.mandatory) if (prop.indexOf("Moz") != -1) delete constraints.mandatory[prop];
    constraints = mergeConstraints(constraints, sdpConstraints);
    pc.createOffer(setLocalAndSendMessage, null, constraints)

}

function doAnswer() {
  pc.createAnswer(setLocalAndSendMessage, null, sdpConstraints)
}

function setLocalAndSendMessage(sessionDescription) {
  pc.setLocalDescription(sessionDescription)
  sendMessage(sessionDescription);
}

function mergeConstraints(obj1, obj2) {
  var merged = obj1;
  for (var name in obj2.mandatory)
    merged.mandatory[name] = obj2.mandatory[name]
    merged.optional.concat(ob2.optional)
    return merged;
};
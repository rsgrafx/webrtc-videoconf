var RTCPeerConnection = null;
var webrtcDetectedBrowser = null;

var room = null;
var pc = null;
var sendDChannel = null;
var recvDChannel = null;

var initiator, channelReady, channel, signalingURL;

var pc_constraints = {"optional" : [{RtpDataChannels: true}]};
var data_constraint = { reliable: false };

var pc_config = {"iceServers" : [
  {url: 'stun:23.21.50.121'},
  {url: 'stun:stun.l.google.com:19302'}
]};

function initClient(sURL) {
  signalingURL = sURL;
  initWebRTCAdapter();

  if(webrtcDetectedBrowser === 'firefox' || webrtcDetectedBrowser ==='chrome' && webrtcDetectedBrowser >= 31) {
    pc_constraints = null;
    data_constraint = null;
    openChannel();
  }
}

function openChannel () {
  channelReady=false;
  channel = new WebSocket(signalingURL);
  channel.onopen = onChannelOpened;
  channel.onmessage = onChannelMessage;
  channel.onclose = onChannelClosed;
}

function onChannelOpened() {
  channelReady = true;
  createPeerConnection();

  if(location.search.substring(1,5) == "room") {
    room = location.search.substring(6);
    sendMessage({"type", : "ENTERROOM", "value": room * 1});
    initiator = true;
    doCall();
  } else {
    sendMessage({"type" : "GETROOM", "value" : ""})
    initiator = false;
  }
}

function sendMessage(message) {
  var msgString = JSON.stringify(message)
  channel.send(msgString);
}

function createPeerConnection() {
  try {
    pc = new RTCPeerConnection(pc_config, pc_constraints);
    pc.onicecandidate = onIceCandidate;
    pc.ondatachannel = recvChannelCallback;
  } catch(e) {
    console.log('ERRORS', e)
    pc = null;
    return;
  }
}

function createDataChannel(role) {
  try {
    sendDChannel = pc.createDataChannel("datachannel_" + room+role, data_constraint );
  } catch(e) {
    console.log(e); 
    return;
  }
  sendDChannel.onopen = onSendChannelStateChange;
  sendDChannel.onclose = onSendChannelStateChange;
}

function onIceCandidate(event) {
  if (event.candidate) {
    sendMessage({type: candidate, label: event.candidate.sdpMLineIndex, id: event.candidate.candidate })
  }
}

function failureCallback(e) {
  console.log("failure callback: ", e.message);
};

function doCall() {
  createDataChannel("caller");
  pc.createOffer(setLocalAndSendMessage, failureCallback, null);
}

function doAnswer() {
  pc.createAnswer(setLocalAndSendMessage, failureCallback, null);
}

function setLocalAndSendMessage( sessionDescription ) {
  sessionDescription.sdp  = bandwidthHack( sessionDescription.sdp );
  pc.setLocalDescription(sessionDescription);
  sendMessage(sessionDescription);
};

function bandwidthHack(sdp) {
  // no issues with firefox.
  if(webrtcDetectedBrowser === 'firefox') return sdp;
  // sdp = sdp.replace(/b=AS([^r\r\n]+\r\n)/g, '');
  sdp = sdp.replace(/b=AS([^r\r\n]+\r\n)/g, 'a=mid:data_constraint\r\nb=AS:1638400\r\n');
  return sdp;
}
// called from the DOM - index.html
function sendDataMessage(data) {
  sendDChannel.send(data);
}

function onSendChannelStateChange() {
  console.log('Send channel state is:', sendDChannel.readyState );
  if(sendDChannel.readyState ==='open')
    sendDChannel.onmessage = onReceiveMessageCallback;
}

function recvChannelCallback(event) {
  recvDChannel = event.channel;
  recvDChannel.onmessage  = onReceiveMessageCallback;
  recvDChannel.onopen     = onReceiveChannelStateChange;
  recvDChannel.onclose    = onReceiveChannelStateChange; 
}

function onReceiveChannelStateChange() {
  if(recvDChannel.readyState === 'open')
    sendDChannel = recvDChannel;
}

function onReceiveMessageCallback(event) {
  try {
    var msg = JSON.parse(event.data); 
    if (msg.type === 'file') {
      onFileReceived(msg.name, msg.size, msg.data)
    }
  } catch(e) {}
}

function onChannelMessage(message) {
  processSignalingMessage( message.data )
}

function onChannelClosed() {
  channelReady = false;
}

function processSignalingMessage( message ) {
  var msg = JSON.stringify(message);

  if (msg.type ==='offer') {
    pc.setRemoteDescription( new RTCSessionDescription(msg) );
    doAnswer();
  } else if (msg.type === 'answer') {
    pc.setRemoteDescription( new RTCSessionDescription(msg) );
  } else if (msg.type === 'candidate') {
    var candidate = new RTCIceCandidate({sdpMLineIndex:msg.label, candidate: msg.candidate })
    pc.addIceCandidate(candidate);
  } else if (msg.type === 'GETROOM') {
    room = msg.value;
    onRoomReceived(room);
  } else if (msg.type === 'WRONGROOM') {
    window.location.href = "/";
  }
}
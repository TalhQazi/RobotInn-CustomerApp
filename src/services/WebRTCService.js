import {
  RTCPeerConnection,
  RTCIceCandidate,
  RTCSessionDescription,
  mediaDevices,
  MediaStream,
} from 'react-native-webrtc';
import firestore from '@react-native-firebase/firestore';

const configuration = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
  ],
};

class WebRTCService {
  constructor() {
    this.pc = null;
    this.localStream = null;
    this.remoteStream = null;
    this.callState = 'idle';
    this.callId = null;

    this.onStateChange = null;
    this.onRemoteStream = null;
    this.onIncomingCall = null;

    this.callDocListener = null;
    this.globalListener = null;
  }

  setListeners(onStateChange, onRemoteStream) {
    this.onStateChange = onStateChange;
    this.onRemoteStream = onRemoteStream;
  }

  setIncomingListener(onIncomingCall) {
    this.onIncomingCall = onIncomingCall;
  }

  updateState(state) {
    this.callState = state;
    if (this.onStateChange) this.onStateChange(state);
  }

  async setupLocalStream() {
    try {
      const stream = await mediaDevices.getUserMedia({
        audio: true,
        video: false, // Voice calling only
      });
      this.localStream = stream;
      return stream;
    } catch (err) {
      console.error('Failed to get local stream', err);
      return null;
    }
  }

  createPeerConnection() {
    this.pc = new RTCPeerConnection(configuration);

    this.pc.addEventListener('iceconnectionstatechange', (event) => {
      console.log('ICE Connection State:', this.pc?.iceConnectionState);
      if (this.pc?.iceConnectionState === 'disconnected' || this.pc?.iceConnectionState === 'failed') {
        this.endCall();
      }
    });

    this.pc.addEventListener('track', (event) => {
      console.log('Got remote track', event.streams[0]);
      this.remoteStream = event.streams[0];
      if (this.onRemoteStream && this.remoteStream) {
        this.onRemoteStream(this.remoteStream);
      }
    });

    if (this.localStream) {
      this.localStream.getTracks().forEach((track) => {
        if (this.localStream) {
          this.pc?.addTrack(track, this.localStream);
        }
      });
    }
  }

  // Caller side: Start a call
  async startCall(callerId, callerName, receiverId) {
    this.callId = firestore().collection('calls').doc().id;
    this.updateState('calling');

    await this.setupLocalStream();
    this.createPeerConnection();

    const callDoc = firestore().collection('calls').doc(this.callId);
    const callerCandidates = callDoc.collection('callerCandidates');

    this.pc?.addEventListener('icecandidate', (event) => {
      if (event.candidate) {
        callerCandidates.add(event.candidate.toJSON());
      }
    });

    const offerDescription = await this.pc?.createOffer({});
    await this.pc?.setLocalDescription(offerDescription);

    const callData = {
      callerId,
      callerName,
      receiverId,
      offer: {
        type: offerDescription.type,
        sdp: offerDescription.sdp,
      },
      status: 'ringing',
      createdAt: firestore.FieldValue.serverTimestamp(),
    };

    await callDoc.set(callData);

    // Listen for answer
    this.callDocListener = callDoc.onSnapshot((snapshot) => {
      const data = snapshot.data();
      if (!this.pc?.currentRemoteDescription && data?.answer) {
        const answerDescription = new RTCSessionDescription(data.answer);
        this.pc?.setRemoteDescription(answerDescription);
      }
      
      if (data?.status === 'connected') {
        this.updateState('connected');
      } else if (data?.status === 'rejected') {
        this.updateState('rejected');
        this.endCall();
      } else if (data?.status === 'ended') {
        this.endCall();
      }
    });

    // Listen for remote ICE candidates
    const receiverCandidates = callDoc.collection('receiverCandidates');
    receiverCandidates.onSnapshot((snapshot) => {
      snapshot.docChanges().forEach((change) => {
        if (change.type === 'added') {
          const candidate = new RTCIceCandidate(change.doc.data());
          this.pc?.addIceCandidate(candidate);
        }
      });
    });
  }

  // Receiver side: Answer a call
  async answerCall(callId) {
    this.callId = callId;
    this.updateState('connecting');

    await this.setupLocalStream();
    this.createPeerConnection();

    const callDoc = firestore().collection('calls').doc(callId);
    const receiverCandidates = callDoc.collection('receiverCandidates');

    this.pc?.addEventListener('icecandidate', (event) => {
      if (event.candidate) {
        receiverCandidates.add(event.candidate.toJSON());
      }
    });

    const callData = (await callDoc.get()).data();
    if (callData?.offer) {
      const offerDescription = new RTCSessionDescription(callData.offer);
      await this.pc?.setRemoteDescription(offerDescription);

      const answerDescription = await this.pc?.createAnswer({});
      await this.pc?.setLocalDescription(answerDescription);

      await callDoc.update({
        answer: {
          type: answerDescription.type,
          sdp: answerDescription.sdp,
        },
        status: 'connected',
      });
      this.updateState('connected');
    }

    // Listen for remote ICE candidates
    const callerCandidates = callDoc.collection('callerCandidates');
    callerCandidates.onSnapshot((snapshot) => {
      snapshot.docChanges().forEach((change) => {
        if (change.type === 'added') {
          const candidate = new RTCIceCandidate(change.doc.data());
          this.pc?.addIceCandidate(candidate);
        }
      });
    });

    this.callDocListener = callDoc.onSnapshot((snapshot) => {
      const data = snapshot.data();
      if (data?.status === 'ended') {
        this.endCall();
      }
    });
  }

  async rejectCall(callId) {
    await firestore().collection('calls').doc(callId).update({ status: 'rejected' });
    this.endCall();
  }

  async endCall() {
    if (this.callId) {
      firestore().collection('calls').doc(this.callId).update({ status: 'ended' }).catch(() => {});
    }

    if (this.pc) {
      this.pc.close();
      this.pc = null;
    }

    if (this.localStream) {
      this.localStream.getTracks().forEach((track) => track.stop());
      this.localStream.release();
      this.localStream = null;
    }

    if (this.callDocListener) {
      this.callDocListener();
      this.callDocListener = null;
    }

    this.remoteStream = null;
    this.callId = null;
    this.updateState('idle');
  }

  // Listen globally for incoming calls to this user
  subscribeToIncomingCalls(myUserId) {
    if (this.globalListener) this.globalListener();

    this.globalListener = firestore()
      .collection('calls')
      .where('receiverId', '==', String(myUserId))
      .where('status', '==', 'ringing')
      .onSnapshot((snapshot) => {
        snapshot.docChanges().forEach((change) => {
          if (change.type === 'added') {
            const data = change.doc.data();
            if (this.onIncomingCall && this.callState === 'idle') {
               this.onIncomingCall({ id: change.doc.id, ...data });
            }
          }
        });
      });
  }
}

export const webrtcService = new WebRTCService();

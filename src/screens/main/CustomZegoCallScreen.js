import React, { useState, useEffect, useRef } from 'react';
import { View, StyleSheet, TouchableOpacity, Text, Animated, StatusBar } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import LinearGradient from 'react-native-linear-gradient';
import Icon from 'react-native-vector-icons/Feather';
import { webrtcService } from '../../services/WebRTCService';
import { COLORS } from '../../theme/colors';

const AVATAR_SIZE = 110;
const RING1 = AVATAR_SIZE + 36;
const RING2 = AVATAR_SIZE + 76;
const RING3 = AVATAR_SIZE + 116;

const WebRTCCallUI = ({ navigation, route }) => {
  const { isIncoming, callerId, callerName, receiverId, callId } = route.params || {};
  const insets = useSafeAreaInsets();
  
  const [callState, setCallState] = useState(webrtcService.callState);
  const [elapsed, setElapsed] = useState(0);
  const [isMuted, setIsMuted] = useState(false);
  const [isSpeaker, setIsSpeaker] = useState(false);

  const contactName = callerName || 'User';
  const initials = contactName.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase();

  const pulse1 = useRef(new Animated.Value(1)).current;
  const pulse2 = useRef(new Animated.Value(1)).current;
  const pulse3 = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    // Start or answer the call automatically when the screen mounts
    if (isIncoming && callId) {
      // Just waiting for user to press "Answer" - but since this UI currently answers automatically or shows controls:
      // We wait for the user to answer.
    } else if (!isIncoming && callerId && receiverId && callState === 'idle') {
      webrtcService.startCall(callerId, callerName, receiverId);
    }

    const stateListener = (state) => {
      setCallState(state);
      if (state === 'ended' || state === 'rejected') {
        setTimeout(() => {
          if (navigation.canGoBack()) navigation.goBack();
          else navigation.navigate('MainTabs');
        }, 500);
      }
    };

    const streamListener = (stream) => {
      console.log('Got remote stream in UI');
    };

    webrtcService.setListeners(stateListener, streamListener);

    return () => {
      // Don't auto-end here because they might minimize the app
    };
  }, []);

  useEffect(() => {
    if (callState === 'connected') return;
    const createPulse = (anim, delay) =>
      Animated.loop(
        Animated.sequence([
          Animated.delay(delay),
          Animated.timing(anim, { toValue: 1.6, duration: 900, useNativeDriver: true }),
          Animated.timing(anim, { toValue: 1, duration: 900, useNativeDriver: true }),
        ])
      );

    const p1 = createPulse(pulse1, 0);
    const p2 = createPulse(pulse2, 300);
    const p3 = createPulse(pulse3, 600);
    p1.start(); p2.start(); p3.start();
    return () => { p1.stop(); p2.stop(); p3.stop(); };
  }, [callState]);

  useEffect(() => {
    if (callState !== 'connected') return;
    const interval = setInterval(() => setElapsed(e => e + 1), 1000);
    return () => clearInterval(interval);
  }, [callState]);

  const formatElapsed = (s) => {
    const m = Math.floor(s / 60).toString().padStart(2, '0');
    const sec = (s % 60).toString().padStart(2, '0');
    return `${m}:${sec}`;
  };

  const handleEndCall = () => {
    webrtcService.endCall();
    if (navigation.canGoBack()) navigation.goBack();
    else navigation.navigate('MainTabs');
  };

  const handleAnswerCall = () => {
    if (callId) {
      webrtcService.answerCall(callId);
    }
  };

  const handleToggleMute = () => {
    const nextMuted = !isMuted;
    setIsMuted(nextMuted);
    if (webrtcService.localStream) {
      webrtcService.localStream.getAudioTracks().forEach(track => {
        track.enabled = !nextMuted;
      });
    }
  };

  const handleToggleSpeaker = () => {
    setIsSpeaker(!isSpeaker);
    // Note: react-native-incall-manager is usually required to route audio to speaker properly.
    // For now, this is a placeholder UI toggle.
  };

  let statusText = 'Connecting...';
  if (callState === 'calling') statusText = 'Calling...';
  if (callState === 'ringing') statusText = 'Ringing...';
  if (callState === 'connected') statusText = formatElapsed(elapsed);
  if (callState === 'ended') statusText = 'Call Ended';

  return (
    <View style={styles.root}>
      <StatusBar barStyle="light-content" backgroundColor="transparent" translucent />
      <LinearGradient
        colors={['#1A2E35', '#0D1F26', '#071318']}
        style={StyleSheet.absoluteFillObject}
      />

      <View style={[styles.topBar, { paddingTop: insets.top + 12 }]}>
        <Text style={styles.appName}>RobotInn</Text>
        <Text style={styles.callTypeLabel}>Voice Call</Text>
      </View>

      <View style={styles.avatarSection}>
        {callState !== 'connected' && (
          <>
            <Animated.View style={[styles.pulseRing, styles.pulseRing3, { transform: [{ scale: pulse3 }] }]} />
            <Animated.View style={[styles.pulseRing, styles.pulseRing2, { transform: [{ scale: pulse2 }] }]} />
            <Animated.View style={[styles.pulseRing, styles.pulseRing1, { transform: [{ scale: pulse1 }] }]} />
          </>
        )}

        <View style={styles.avatarCircle}>
          <Text style={styles.avatarText}>{initials}</Text>
        </View>
      </View>

      <View style={styles.nameSection}>
        <Text style={styles.contactName}>{contactName}</Text>
        <Text style={styles.callStatus}>{statusText}</Text>
      </View>

      <View style={[styles.controls, { paddingBottom: insets.bottom + 32 }]}>
        {isIncoming && callState === 'idle' ? (
          <>
            <View style={styles.controlItem}>
              <TouchableOpacity style={styles.endCallBtn} onPress={handleEndCall}>
                <Icon name="phone" size={30} color="#fff" style={{ transform: [{ rotate: '135deg' }] }} />
              </TouchableOpacity>
              <Text style={styles.controlLabel}>Decline</Text>
            </View>

            <View style={styles.controlItem}>
              <TouchableOpacity style={[styles.endCallBtn, { backgroundColor: '#4CAF50' }]} onPress={handleAnswerCall}>
                <Icon name="phone" size={30} color="#fff" />
              </TouchableOpacity>
              <Text style={styles.controlLabel}>Answer</Text>
            </View>
          </>
        ) : (
          <>
            <View style={styles.controlItem}>
              <TouchableOpacity
                style={[styles.controlBtn, isMuted && styles.controlBtnActive]}
                onPress={handleToggleMute}
              >
                <Icon name={isMuted ? 'mic-off' : 'mic'} size={26} color="#fff" />
              </TouchableOpacity>
              <Text style={styles.controlLabel}>{isMuted ? 'Unmute' : 'Mute'}</Text>
            </View>

            <View style={styles.controlItem}>
              <TouchableOpacity style={styles.endCallBtn} onPress={handleEndCall}>
                <Icon name="phone" size={30} color="#fff" style={{ transform: [{ rotate: '135deg' }] }} />
              </TouchableOpacity>
              <Text style={styles.controlLabel}>End</Text>
            </View>

            <View style={styles.controlItem}>
              <TouchableOpacity
                style={[styles.controlBtn, isSpeaker && styles.controlBtnActive]}
                onPress={handleToggleSpeaker}
              >
                <Icon name="volume-2" size={26} color="#fff" />
              </TouchableOpacity>
              <Text style={styles.controlLabel}>{isSpeaker ? 'Speaker On' : 'Speaker'}</Text>
            </View>
          </>
        )}
      </View>
    </View>
  );
};

// We keep the old names so that AppNavigator routes still work seamlessly
export const CustomWaitingScreen = (props) => <WebRTCCallUI {...props} />;
export const CustomInCallScreen = (props) => <WebRTCCallUI {...props} />;

const styles = StyleSheet.create({
  root: {
    flex: 1,
    alignItems: 'center',
  },
  topBar: {
    alignItems: 'center',
    paddingBottom: 8,
  },
  appName: {
    color: 'rgba(255,255,255,0.4)',
    fontSize: 13,
    letterSpacing: 2,
    fontWeight: '600',
    textTransform: 'uppercase',
  },
  callTypeLabel: {
    color: 'rgba(255,255,255,0.5)',
    fontSize: 12,
    marginTop: 4,
  },
  avatarSection: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pulseRing: {
    position: 'absolute',
    borderRadius: 9999,
  },
  pulseRing1: {
    width: RING1,
    height: RING1,
    backgroundColor: 'rgba(46, 196, 182, 0.15)',
  },
  pulseRing2: {
    width: RING2,
    height: RING2,
    backgroundColor: 'rgba(46, 196, 182, 0.10)',
  },
  pulseRing3: {
    width: RING3,
    height: RING3,
    backgroundColor: 'rgba(46, 196, 182, 0.06)',
  },
  avatarCircle: {
    width: AVATAR_SIZE,
    height: AVATAR_SIZE,
    borderRadius: AVATAR_SIZE / 2,
    backgroundColor: '#2EC4B6',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 3,
    borderColor: 'rgba(255,255,255,0.25)',
    elevation: 8,
    shadowColor: '#2EC4B6',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.5,
    shadowRadius: 12,
  },
  avatarText: {
    color: '#fff',
    fontSize: 36,
    fontWeight: '700',
  },
  nameSection: {
    alignItems: 'center',
    marginBottom: 48,
  },
  contactName: {
    color: '#fff',
    fontSize: 28,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  callStatus: {
    color: '#2EC4B6',
    fontSize: 16,
    marginTop: 8,
    fontWeight: '500',
    letterSpacing: 0.5,
  },
  controls: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 36,
    width: '100%',
    paddingHorizontal: 32,
  },
  controlItem: {
    alignItems: 'center',
    gap: 10,
  },
  controlBtn: {
    width: 62,
    height: 62,
    borderRadius: 31,
    backgroundColor: 'rgba(255,255,255,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
  },
  controlBtnActive: {
    backgroundColor: 'rgba(46, 196, 182, 0.35)',
    borderColor: '#2EC4B6',
  },
  endCallBtn: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: '#E53935',
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 6,
    shadowColor: '#E53935',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.5,
    shadowRadius: 10,
  },
  controlLabel: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: 12,
    fontWeight: '500',
  },
});

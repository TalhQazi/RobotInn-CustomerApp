import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Animated, Easing, Image, Dimensions } from 'react-native';
import { COLORS } from '../theme/colors';
import { getData, removeData } from '../storage/asyncStorage';
import { ASYNC_STORAGE_KEYS } from '../utils/constants';
import { authAPI } from '../services/api';
import { resetToAuth, resetToMain } from '../navigation/navigationRef';

const { width, height } = Dimensions.get('window');

const SplashScreen = () => {
  const rotateValue = useRef(new Animated.Value(0)).current;
  const scaleValue = useRef(new Animated.Value(0.3)).current;
  const opacityValue = useRef(new Animated.Value(0)).current;
  const translateYValue = useRef(new Animated.Value(50)).current;
  const pulseValue = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(rotateValue, {
        toValue: 1,
        duration: 1800,
        easing: Easing.bezier(0.25, 0.1, 0.25, 1),
        useNativeDriver: true,
      }),
      Animated.spring(scaleValue, {
        toValue: 1,
        friction: 6,
        tension: 40,
        useNativeDriver: true,
      }),
      Animated.timing(opacityValue, {
        toValue: 1,
        duration: 800,
        useNativeDriver: true,
      }),
      Animated.spring(translateYValue, {
        toValue: 0,
        tension: 30,
        friction: 7,
        useNativeDriver: true,
      }),
    ]).start();

    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseValue, {
          toValue: 1.2,
          duration: 1000,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(pulseValue, {
          toValue: 1,
          duration: 1000,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ])
    ).start();

    let cancelled = false;

    const resolveInitialRoute = async () => {
      const minSplashMs = 2200;
      const start = Date.now();

      let goMain = false;
      try {
        const token = await getData(ASYNC_STORAGE_KEYS.AUTH_TOKEN);
        if (token) {
          try {
            const me = await authAPI.getMe();
            const userType = String(me?.data?.type || '').toLowerCase();
            if (userType === 'customer') {
              goMain = true;
            } else {
              await authAPI.logout();
            }
          } catch {
            await removeData(ASYNC_STORAGE_KEYS.AUTH_TOKEN);
            await removeData(ASYNC_STORAGE_KEYS.USER_DATA);
          }
        }
      } catch (e) {
        console.log('splash auth check', e);
      }

      const elapsed = Date.now() - start;
      if (elapsed < minSplashMs) {
        await new Promise((r) => setTimeout(r, minSplashMs - elapsed));
      }

      if (cancelled) return;

      if (goMain) {
        resetToMain();
      } else {
        resetToAuth();
      }
    };

    resolveInitialRoute();

    return () => {
      cancelled = true;
    };
  }, []);

  const spin = rotateValue.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });

  const pulseRing = pulseValue.interpolate({
    inputRange: [1, 1.2],
    outputRange: [1, 1.2],
  });

  return (
    <View style={styles.container}>
      <View style={styles.circlesContainer}>
        {[...Array(3)].map((_, i) => (
          <Animated.View
            key={i}
            style={[
              styles.circle,
              {
                width: width * (0.5 + i * 0.2),
                height: width * (0.5 + i * 0.2),
                opacity: 0.1 - i * 0.03,
                transform: [{ scale: pulseRing }],
                top: height * (0.2 + i * 0.1),
                left: -width * (0.2 - i * 0.05),
              },
            ]}
          />
        ))}
      </View>

      <Animated.View
        style={[
          styles.contentContainer,
          {
            opacity: opacityValue,
            transform: [{ translateY: translateYValue }],
          },
        ]}
      >
        <Animated.View
          style={[
            styles.outerRing,
            {
              transform: [{ scale: pulseRing }],
            },
          ]}
        >
          <View style={styles.innerRing}>
            <Animated.View
              style={[
                styles.logoContainer,
                {
                  transform: [{ rotate: spin }, { scale: scaleValue }],
                },
              ]}
            >
              <Image
                source={require('../assets/images/logo1.png')}
                style={styles.logoImage}
                resizeMode="contain"
              />
            </Animated.View>
          </View>
        </Animated.View>

        <View style={styles.textContainer}>
          <Text style={styles.title}>RobotInn</Text>
          <View style={styles.divider} />
          <Text style={styles.subtitle}>Delivering Happiness</Text>

          <View style={styles.dotsContainer}>
            {[...Array(3)].map((_, i) => (
              <Animated.View
                key={i}
                style={[
                  styles.dot,
                  {
                    opacity: opacityValue.interpolate({
                      inputRange: [0, 1],
                      outputRange: [0, 0.6 + i * 0.2],
                    }),
                    transform: [
                      {
                        scale: opacityValue.interpolate({
                          inputRange: [0, 1],
                          outputRange: [0.5, 1],
                        }),
                      },
                    ],
                  },
                ]}
              />
            ))}
          </View>
        </View>
      </Animated.View>

      <Animated.View
        style={[
          styles.footer,
          {
            opacity: opacityValue,
            transform: [{ translateY: translateYValue }],
          },
        ]}
      >
        <Text style={styles.versionText}>Version 1.0.0</Text>
        <Text style={styles.copyrightText}>© 2024 RobotInn. All rights reserved.</Text>
      </Animated.View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: COLORS.primary,
  },
  circlesContainer: {
    position: 'absolute',
    width: '100%',
    height: '100%',
  },
  circle: {
    position: 'absolute',
    borderRadius: 999,
    backgroundColor: COLORS.white,
    opacity: 0.1,
  },
  contentContainer: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  outerRing: {
    width: 180,
    height: 180,
    borderRadius: 90,
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: COLORS.shadow,
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.3,
    shadowRadius: 20,
    elevation: 10,
  },
  innerRing: {
    width: 160,
    height: 160,
    borderRadius: 80,
    backgroundColor: 'rgba(255, 255, 255, 0.25)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.3)',
  },
  logoContainer: {
    width: 130,
    height: 130,
    borderRadius: 65,
    backgroundColor: COLORS.white,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: COLORS.shadow,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 15,
    elevation: 10,
  },
  logoImage: {
    width: 100,
    height: 100,
    borderRadius: 50,
  },
  textContainer: {
    marginTop: 40,
    alignItems: 'center',
  },
  title: {
    fontSize: 32,
    fontWeight: '800',
    color: COLORS.white,
    letterSpacing: 1.5,
    textShadowColor: 'rgba(0, 0, 0, 0.2)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 4,
  },
  divider: {
    width: 60,
    height: 3,
    backgroundColor: COLORS.secondary,
    marginVertical: 12,
    borderRadius: 2,
  },
  subtitle: {
    fontSize: 16,
    color: 'rgba(255, 255, 255, 0.9)',
    fontWeight: '500',
    letterSpacing: 0.5,
  },
  dotsContainer: {
    flexDirection: 'row',
    marginTop: 20,
    gap: 8,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: COLORS.white,
  },
  footer: {
    position: 'absolute',
    bottom: 30,
    alignItems: 'center',
  },
  versionText: {
    fontSize: 12,
    color: 'rgba(255, 255, 255, 0.6)',
    marginBottom: 4,
  },
  copyrightText: {
    fontSize: 10,
    color: 'rgba(255, 255, 255, 0.4)',
  },
});

export default SplashScreen;

import React, { useState, useRef, useEffect } from 'react';
import {
  Modal,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
  PanResponder,
  ActivityIndicator,
  Dimensions,
} from 'react-native';
import ImageEditor from '@react-native-community/image-editor';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { COLORS } from '../../theme/colors';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');
const VIEW_SIZE = SCREEN_WIDTH - 40; // 20px padding on each side
const CROP_SIZE = SCREEN_WIDTH - 100; // circular frame size

const ImageCropModal = ({ visible, imageUri, imageWidth, imageHeight, onCancel, onCrop }) => {
  const [scale, setScale] = useState(1);
  const [cropping, setCropping] = useState(false);
  const [renderTrigger, setRenderTrigger] = useState(0);

  const translateX = useRef(0);
  const translateY = useRef(0);
  const lastX = useRef(0);
  const lastY = useRef(0);

  // Reset values when a new image is selected
  useEffect(() => {
    if (visible) {
      setScale(1);
      translateX.current = 0;
      translateY.current = 0;
      lastX.current = 0;
      lastY.current = 0;
      setRenderTrigger(prev => prev + 1);
    }
  }, [visible, imageUri]);

  // Determine initial layout sizes
  let wRender = VIEW_SIZE;
  let hRender = VIEW_SIZE;

  if (imageWidth && imageHeight) {
    if (imageWidth > imageHeight) {
      hRender = VIEW_SIZE;
      wRender = VIEW_SIZE * (imageWidth / imageHeight);
    } else {
      wRender = VIEW_SIZE;
      hRender = VIEW_SIZE * (imageHeight / imageWidth);
    }
  }

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: () => {
        // Start dragging
      },
      onPanResponderMove: (evt, gestureState) => {
        translateX.current = lastX.current + gestureState.dx;
        translateY.current = lastY.current + gestureState.dy;
        setRenderTrigger(prev => prev + 1);
      },
      onPanResponderRelease: () => {
        // Save final position
        lastX.current = translateX.current;
        lastY.current = translateY.current;
      },
    })
  ).current;

  const handleZoomIn = () => {
    setScale(prev => Math.min(3, prev + 0.15));
  };

  const handleZoomOut = () => {
    setScale(prev => Math.max(1, prev - 0.15));
  };

  const handleCrop = async () => {
    if (cropping) return;
    setCropping(true);

    try {
      const wActual = wRender * scale;
      const hActual = hRender * scale;

      const xCenter = VIEW_SIZE / 2 + translateX.current;
      const yCenter = VIEW_SIZE / 2 + translateY.current;

      const xImgStart = xCenter - wActual / 2;
      const yImgStart = yCenter - hActual / 2;

      const xCropStart = (VIEW_SIZE - CROP_SIZE) / 2;
      const yCropStart = (VIEW_SIZE - CROP_SIZE) / 2;

      const dX = xCropStart - xImgStart;
      const dY = yCropStart - yImgStart;

      const fScale = wActual / imageWidth;

      let cropX = dX / fScale;
      let cropY = dY / fScale;
      let cropW = CROP_SIZE / fScale;
      let cropH = CROP_SIZE / fScale;

      // Clamp dimensions to ensure we stay within bounds
      cropX = Math.max(0, Math.min(cropX, imageWidth - cropW));
      cropY = Math.max(0, Math.min(cropY, imageHeight - cropH));
      cropW = Math.min(cropW, imageWidth - cropX);
      cropH = Math.min(cropH, imageHeight - cropY);

      console.log('Cropping image with data:', { cropX, cropY, cropW, cropH });

      const cropData = {
        offset: { x: Math.round(cropX), y: Math.round(cropY) },
        size: { width: Math.round(cropW), height: Math.round(cropH) },
        displaySize: { width: 400, height: 400 },
        resizeMode: 'cover',
        includeBase64: false,
      };

      const croppedResult = await ImageEditor.cropImage(imageUri, cropData);
      onCrop(croppedResult);
    } catch (err) {
      console.error('Failed to crop image:', err);
    } finally {
      setCropping(false);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onCancel}>
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.title}>Adjust Photo</Text>
          <Text style={styles.subtitle}>Drag to move and use buttons to zoom</Text>
        </View>

        {/* Cropper Window */}
        <View style={styles.cropperContainer} {...panResponder.panHandlers}>
          <View style={styles.imageContainer}>
            <Image
              source={{ uri: imageUri }}
              style={{
                width: wRender,
                height: hRender,
                transform: [
                  { scale: scale },
                  { translateX: translateX.current / scale },
                  { translateY: translateY.current / scale },
                ],
              }}
              resizeMode="cover"
            />
          </View>

          {/* Mask Overlays to make it look circular */}
          <View style={styles.overlayContainer} pointerEvents="none">
            <View style={styles.overlayTop} />
            <View style={styles.overlayMiddleRow}>
              <View style={styles.overlaySide} />
              <View style={styles.cropCircleFrame} />
              <View style={styles.overlaySide} />
            </View>
            <View style={styles.overlayBottom} />
          </View>
        </View>

        {/* Zoom Controls */}
        <View style={styles.controls}>
          <TouchableOpacity style={styles.controlBtn} onPress={handleZoomOut}>
            <Ionicons name="remove" size={24} color="#fff" />
          </TouchableOpacity>
          <Text style={styles.zoomText}>{Math.round(scale * 100)}%</Text>
          <TouchableOpacity style={styles.controlBtn} onPress={handleZoomIn}>
            <Ionicons name="add" size={24} color="#fff" />
          </TouchableOpacity>
        </View>

        {/* Actions */}
        <View style={styles.actions}>
          <TouchableOpacity style={styles.cancelBtn} onPress={onCancel} disabled={cropping}>
            <Text style={styles.cancelBtnText}>Cancel</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.saveBtn} onPress={handleCrop} disabled={cropping}>
            {cropping ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <Text style={styles.saveBtnText}>Apply</Text>
            )}
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0F172A',
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 40,
  },
  header: {
    alignItems: 'center',
    marginBottom: 20,
    paddingHorizontal: 20,
  },
  title: {
    fontSize: 22,
    fontWeight: '800',
    color: '#fff',
    marginBottom: 6,
  },
  subtitle: {
    fontSize: 14,
    color: '#94A3B8',
    textAlign: 'center',
  },
  cropperContainer: {
    width: VIEW_SIZE,
    height: VIEW_SIZE,
    backgroundColor: '#1E293B',
    overflow: 'hidden',
    borderRadius: 16,
    position: 'relative',
  },
  imageContainer: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  overlayContainer: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'space-between',
  },
  overlayTop: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.75)',
  },
  overlayBottom: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.75)',
  },
  overlayMiddleRow: {
    height: CROP_SIZE,
    flexDirection: 'row',
  },
  overlaySide: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.75)',
  },
  cropCircleFrame: {
    width: CROP_SIZE,
    height: CROP_SIZE,
    borderRadius: CROP_SIZE / 2,
    borderWidth: 2,
    borderColor: '#2EC4B6',
    backgroundColor: 'transparent',
  },
  controls: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 30,
    backgroundColor: '#1E293B',
    borderRadius: 30,
    paddingHorizontal: 16,
    paddingVertical: 10,
    gap: 20,
  },
  controlBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#334155',
    justifyContent: 'center',
    alignItems: 'center',
  },
  zoomText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
    minWidth: 50,
    textAlign: 'center',
  },
  actions: {
    flexDirection: 'row',
    width: '100%',
    paddingHorizontal: 30,
    marginTop: 40,
    gap: 16,
  },
  cancelBtn: {
    flex: 1,
    paddingVertical: 15,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: '#334155',
    alignItems: 'center',
  },
  cancelBtnText: {
    color: '#94A3B8',
    fontSize: 16,
    fontWeight: '700',
  },
  saveBtn: {
    flex: 1,
    paddingVertical: 15,
    borderRadius: 12,
    backgroundColor: '#2EC4B6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  saveBtnText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
});

export default ImageCropModal;

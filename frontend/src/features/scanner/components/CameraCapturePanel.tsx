import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Image, LayoutChangeEvent, Modal, Pressable, ScrollView, Text, View } from 'react-native';
import { CameraType, CameraView, useCameraPermissions } from 'expo-camera';
import jpeg from 'jpeg-js';
import { toByteArray } from 'base64-js';

import { ActionButton } from '../../../components/ui/ActionButton';

type FrameRect = {
  left: number;
  top: number;
  width: number;
  height: number;
};

type CornerKey = 'tl' | 'tr' | 'bl' | 'br';

type MarkerDetectResult = {
  count: number;
  corners: Record<CornerKey, number>;
  debug: DetectionDebug;
};

type DetectionDebug = {
  roisPreview: Record<CornerKey, { x: number; y: number; size: number }>;
  mapping: {
    scale: number;
    cropX: number;
    cropY: number;
    imageWidth: number;
    imageHeight: number;
  };
};

const LUMA_DARK_THRESHOLD = 90;
const ROI_RELATIVE_SIZE = 0.2;
const MIN_ROI_SIZE = 24;
const CORNER_HIT_THRESHOLD = 0.23;
const DETECT_FRAME_INTERVAL_MS = 550;
const REQUIRED_STREAK = 1;

export function CameraCapturePanel() {
  const [permission, requestPermission] = useCameraPermissions();
  const [facing, setFacing] = useState<CameraType>('back');
  const [isCapturing, setIsCapturing] = useState(false);
  const [lastPhotoUri, setLastPhotoUri] = useState<string | null>(null);
  const [capturedPhotos, setCapturedPhotos] = useState<string[]>([]);
  const [selectedPhoto, setSelectedPhoto] = useState<string | null>(null);
  const [previewSize, setPreviewSize] = useState({ width: 0, height: 0 });
  const [markerCount, setMarkerCount] = useState(0);
  const [autoStatus, setAutoStatus] = useState<'idle' | 'tracking' | 'captured'>('idle');
  const [cornerScores, setCornerScores] = useState<Record<CornerKey, number>>({ tl: 0, tr: 0, bl: 0, br: 0 });
  const [debugInfo, setDebugInfo] = useState<DetectionDebug | null>(null);

  const cameraRef = useRef<CameraView | null>(null);
  const isAnalyzingRef = useRef(false);
  const autoCaptureLockRef = useRef(false);
  const detectionStreakRef = useRef(0);

  const guideSize = 36;
  const guideThickness = 4;

  const toggleFacing = () => {
    setFacing((current) => (current === 'back' ? 'front' : 'back'));
    setMarkerCount(0);
    setAutoStatus('idle');
    setCornerScores({ tl: 0, tr: 0, bl: 0, br: 0 });
    setDebugInfo(null);
    detectionStreakRef.current = 0;
    autoCaptureLockRef.current = false;
  };

  const capturePhoto = useCallback(async () => {
    if (!cameraRef.current || isCapturing) {
      return;
    }

    try {
      setIsCapturing(true);
      const photo = await cameraRef.current.takePictureAsync({
        quality: 0.8,
        skipProcessing: true,
      });

      if (photo?.uri) {
        setLastPhotoUri(photo.uri);
        setCapturedPhotos((prev) => [photo.uri, ...prev].slice(0, 20));
        setAutoStatus('captured');
      }
    } catch {
      // keep UI stable
    } finally {
      setIsCapturing(false);
    }
  }, [isCapturing]);

  const onPreviewLayout = (event: LayoutChangeEvent) => {
    const { width, height } = event.nativeEvent.layout;
    setPreviewSize({ width, height });
  };

  const frame = getA4Frame(previewSize.width, previewSize.height);

  const runMarkerDetection = useCallback(async () => {
    if (!cameraRef.current || !frame || isCapturing || isAnalyzingRef.current || autoCaptureLockRef.current) {
      return;
    }

    try {
      isAnalyzingRef.current = true;

      const preview = await cameraRef.current.takePictureAsync({
        base64: true,
        quality: 0.2,
        skipProcessing: true,
      });

      if (!preview?.base64 || !preview.width || !preview.height) {
        return;
      }

      const result = detectMarkerCorners(
        preview.base64,
        { width: preview.width, height: preview.height },
        frame,
        previewSize,
      );

      setMarkerCount(result.count);
      setCornerScores(result.corners);
      setDebugInfo(result.debug);
      setAutoStatus('tracking');

      if (result.count >= 4) {
        detectionStreakRef.current += 1;
      } else {
        detectionStreakRef.current = 0;
      }

      if (detectionStreakRef.current >= REQUIRED_STREAK) {
        autoCaptureLockRef.current = true;
        await capturePhoto();
      }
    } catch {
      // ignore per-frame detection errors
    } finally {
      isAnalyzingRef.current = false;
    }
  }, [frame, capturePhoto, isCapturing, previewSize]);

  useEffect(() => {
    if (!permission?.granted || !frame) {
      return;
    }

    const id = setInterval(() => {
      void runMarkerDetection();
    }, DETECT_FRAME_INTERVAL_MS);

    return () => clearInterval(id);
  }, [permission?.granted, frame, runMarkerDetection]);

  if (!permission) {
    return (
      <View className="h-full items-center justify-center gap-3">
        <ActivityIndicator color="#67e8f9" />
        <Text className="text-sm text-slate-300">Loading camera permissions...</Text>
      </View>
    );
  }

  if (!permission.granted) {
    return (
      <View className="h-full items-center justify-center gap-4 px-6">
        <Text className="text-center text-sm text-slate-300">
          Camera access is required to scan marker corners and capture sheets.
        </Text>
        <ActionButton label="Grant Camera Permission" onPress={requestPermission} />
      </View>
    );
  }

  return (
    <View className="h-full">
      <View className="h-full overflow-hidden rounded-xl border border-cyan-200/25 bg-black" onLayout={onPreviewLayout}>
        <CameraView ref={cameraRef} style={{ flex: 1 }} facing={facing} />

        <View pointerEvents="none" className="absolute inset-0">
          <View className="absolute left-0 right-0 top-0 h-9 bg-black/40" />
          <Text className="absolute left-4 right-4 top-2.5 text-center text-xs font-semibold text-cyan-100">
            Move the sheet so marker squares sit on the corner guides
          </Text>

          <View className="absolute left-3 top-10 rounded-lg bg-black/55 px-3 py-2">
            <Text className="text-xs text-cyan-100">Markers: {markerCount}/4</Text>
            <Text className="mt-1 text-[11px] text-slate-200">
              {autoStatus === 'captured' ? 'Auto captured' : autoStatus === 'tracking' ? 'Tracking...' : 'Idle'}
            </Text>
            <Text className="mt-1 text-[10px] text-slate-300">Streak: {detectionStreakRef.current}/{REQUIRED_STREAK}</Text>
            {debugInfo ? (
              <Text className="mt-1 text-[10px] text-slate-400">
                map s:{debugInfo.mapping.scale.toFixed(2)} cx:{debugInfo.mapping.cropX.toFixed(1)}
                cy:{debugInfo.mapping.cropY.toFixed(1)}
              </Text>
            ) : null}
          </View>

          {frame ? (
            <>
              <View
                className="absolute rounded-2xl border border-cyan-300/35"
                style={{ left: frame.left, top: frame.top, width: frame.width, height: frame.height }}
              />

              <CornerGuide corner="tl" x={frame.left} y={frame.top} size={guideSize} thickness={guideThickness} />
              <CornerGuide
                corner="tr"
                x={frame.left + frame.width - guideSize}
                y={frame.top}
                size={guideSize}
                thickness={guideThickness}
              />
              <CornerGuide
                corner="bl"
                x={frame.left}
                y={frame.top + frame.height - guideSize}
                size={guideSize}
                thickness={guideThickness}
              />
              <CornerGuide
                corner="br"
                x={frame.left + frame.width - guideSize}
                y={frame.top + frame.height - guideSize}
                size={guideSize}
                thickness={guideThickness}
              />

              {debugInfo
                ? (Object.keys(debugInfo.roisPreview) as CornerKey[]).map((k) => {
                    const roi = debugInfo.roisPreview[k];
                    const score = cornerScores[k];
                    const hit = score >= CORNER_HIT_THRESHOLD;

                    return (
                      <View
                        key={`roi-${k}`}
                        style={{
                          position: 'absolute',
                          left: roi.x,
                          top: roi.y,
                          width: roi.size,
                          height: roi.size,
                          borderWidth: 2,
                          borderColor: hit ? '#22c55e' : '#f59e0b',
                          backgroundColor: hit ? 'rgba(34,197,94,0.12)' : 'rgba(245,158,11,0.10)',
                        }}
                      >
                        <Text
                          style={{
                            position: 'absolute',
                            top: -14,
                            left: 0,
                            color: hit ? '#86efac' : '#fcd34d',
                            fontSize: 10,
                            fontWeight: '700',
                          }}
                        >
                          {k.toUpperCase()} {score.toFixed(2)}
                        </Text>
                      </View>
                    );
                  })
                : null}
            </>
          ) : null}
        </View>

        <View className="absolute bottom-0 w-full bg-black/45 p-3">
          <View className="flex-row gap-2">
            <View className="flex-1">
              <ActionButton
                label={isCapturing ? 'Capturing...' : 'Capture'}
                onPress={() => void capturePhoto()}
                disabled={isCapturing}
              />
            </View>
            <View className="flex-1">
              <ActionButton label="Flip Camera" variant="ghost" onPress={toggleFacing} />
            </View>
          </View>
        </View>

        {capturedPhotos.length > 0 ? (
          <View className="absolute bottom-[82px] w-full px-3">
            <View className="rounded-xl border border-cyan-200/25 bg-black/55 p-2">
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
                {capturedPhotos.map((uri, index) => (
                  <Pressable key={`${uri}-${index}`} onPress={() => setSelectedPhoto(uri)}>
                    <Image
                      source={{ uri }}
                      style={{
                        width: 72,
                        height: 72,
                        borderRadius: 8,
                        borderWidth: 1,
                        borderColor: 'rgba(103,232,249,0.55)',
                      }}
                      resizeMode="cover"
                    />
                  </Pressable>
                ))}
              </ScrollView>
            </View>
          </View>
        ) : null}
      </View>

      <Modal visible={!!selectedPhoto} transparent animationType="fade" onRequestClose={() => setSelectedPhoto(null)}>
        <View className="flex-1 items-center justify-center bg-black/85 px-4">
          <View className="w-full max-w-[900px] overflow-hidden rounded-2xl border border-cyan-200/30 bg-[#020712] p-3">
            {selectedPhoto ? (
              <Image source={{ uri: selectedPhoto }} style={{ width: '100%', height: 560, borderRadius: 10 }} resizeMode="contain" />
            ) : null}
            <View className="mt-3">
              <ActionButton label="Close Preview" variant="ghost" onPress={() => setSelectedPhoto(null)} />
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

function getA4Frame(containerWidth: number, containerHeight: number): FrameRect | null {
  if (!containerWidth || !containerHeight) {
    return null;
  }

  const topReserved = 72;
  const bottomReserved = 104;
  const sidePadding = 20;

  const usableWidth = containerWidth - sidePadding * 2;
  const usableHeight = containerHeight - topReserved - bottomReserved;

  if (usableWidth <= 0 || usableHeight <= 0) {
    return null;
  }

  const a4Ratio = 210 / 297;

  let frameWidth = usableWidth;
  let frameHeight = frameWidth / a4Ratio;

  if (frameHeight > usableHeight) {
    frameHeight = usableHeight;
    frameWidth = frameHeight * a4Ratio;
  }

  const left = (containerWidth - frameWidth) / 2;
  const top = topReserved + (usableHeight - frameHeight) / 2;

  return {
    left,
    top,
    width: frameWidth,
    height: frameHeight,
  };
}

type CornerGuideProps = {
  corner: CornerKey;
  x: number;
  y: number;
  size: number;
  thickness: number;
};

function CornerGuide({ corner, x, y, size, thickness }: CornerGuideProps) {
  let horizontalStyle: object;
  let verticalStyle: object;

  switch (corner) {
    case 'tl':
      horizontalStyle = { top: 0, left: 0, width: size, height: thickness };
      verticalStyle = { top: 0, left: 0, width: thickness, height: size };
      break;
    case 'tr':
      horizontalStyle = { top: 0, right: 0, width: size, height: thickness };
      verticalStyle = { top: 0, right: 0, width: thickness, height: size };
      break;
    case 'bl':
      horizontalStyle = { bottom: 0, left: 0, width: size, height: thickness };
      verticalStyle = { bottom: 0, left: 0, width: thickness, height: size };
      break;
    case 'br':
    default:
      horizontalStyle = { bottom: 0, right: 0, width: size, height: thickness };
      verticalStyle = { bottom: 0, right: 0, width: thickness, height: size };
      break;
  }

  return (
    <View
      style={{
        position: 'absolute',
        left: x,
        top: y,
        width: size,
        height: size,
      }}
    >
      <View className="absolute rounded-sm bg-cyan-300" style={horizontalStyle} />
      <View className="absolute rounded-sm bg-cyan-300" style={verticalStyle} />
    </View>
  );
}

function detectMarkerCorners(
  base64: string,
  imageSize: { width: number; height: number },
  frame: FrameRect,
  previewSize: { width: number; height: number },
): MarkerDetectResult {
  const decoded = jpeg.decode(toByteArray(base64), { useTArray: true });
  const rgba = decoded.data as Uint8Array;

  const mapping = getPreviewToImageMapping(previewSize, imageSize);

  const areaX0 = Math.floor(previewToImageX(frame.left, mapping));
  const areaY0 = Math.floor(previewToImageY(frame.top, mapping));
  const areaX1 = Math.floor(previewToImageX(frame.left + frame.width, mapping));
  const areaY1 = Math.floor(previewToImageY(frame.top + frame.height, mapping));

  const areaX = Math.min(areaX0, areaX1);
  const areaY = Math.min(areaY0, areaY1);
  const areaW = Math.abs(areaX1 - areaX0);
  const areaH = Math.abs(areaY1 - areaY0);

  const roiSize = Math.max(MIN_ROI_SIZE, Math.floor(Math.min(areaW, areaH) * ROI_RELATIVE_SIZE));

  const tlRect = { x: areaX, y: areaY, size: roiSize };
  const trRect = { x: areaX + areaW - roiSize, y: areaY, size: roiSize };
  const blRect = { x: areaX, y: areaY + areaH - roiSize, size: roiSize };
  const brRect = { x: areaX + areaW - roiSize, y: areaY + areaH - roiSize, size: roiSize };

  const tl = cornerDarkRatio(rgba, imageSize.width, imageSize.height, tlRect.x, tlRect.y, tlRect.size);
  const tr = cornerDarkRatio(rgba, imageSize.width, imageSize.height, trRect.x, trRect.y, trRect.size);
  const bl = cornerDarkRatio(rgba, imageSize.width, imageSize.height, blRect.x, blRect.y, blRect.size);
  const br = cornerDarkRatio(rgba, imageSize.width, imageSize.height, brRect.x, brRect.y, brRect.size);

  const corners = { tl, tr, bl, br };
  const count = Object.values(corners).filter((ratio) => ratio >= CORNER_HIT_THRESHOLD).length;

  const roisPreview = {
    tl: imageRectToPreviewRect(tlRect, mapping),
    tr: imageRectToPreviewRect(trRect, mapping),
    bl: imageRectToPreviewRect(blRect, mapping),
    br: imageRectToPreviewRect(brRect, mapping),
  };

  return {
    count,
    corners,
    debug: {
      roisPreview,
      mapping: {
        scale: mapping.scale,
        cropX: mapping.cropX,
        cropY: mapping.cropY,
        imageWidth: imageSize.width,
        imageHeight: imageSize.height,
      },
    },
  };
}

function getPreviewToImageMapping(
  previewSize: { width: number; height: number },
  imageSize: { width: number; height: number },
) {
  const previewW = Math.max(1, previewSize.width);
  const previewH = Math.max(1, previewSize.height);
  const imageW = Math.max(1, imageSize.width);
  const imageH = Math.max(1, imageSize.height);

  const scale = Math.max(previewW / imageW, previewH / imageH);
  const displayedW = imageW * scale;
  const displayedH = imageH * scale;
  const cropX = (displayedW - previewW) / 2;
  const cropY = (displayedH - previewH) / 2;

  return {
    scale,
    cropX,
    cropY,
    imageW,
    imageH,
  };
}

function previewToImageX(x: number, mapping: ReturnType<typeof getPreviewToImageMapping>): number {
  return clamp((x + mapping.cropX) / mapping.scale, 0, mapping.imageW - 1);
}

function previewToImageY(y: number, mapping: ReturnType<typeof getPreviewToImageMapping>): number {
  return clamp((y + mapping.cropY) / mapping.scale, 0, mapping.imageH - 1);
}

function imageToPreviewX(x: number, mapping: ReturnType<typeof getPreviewToImageMapping>): number {
  return x * mapping.scale - mapping.cropX;
}

function imageToPreviewY(y: number, mapping: ReturnType<typeof getPreviewToImageMapping>): number {
  return y * mapping.scale - mapping.cropY;
}

function imageRectToPreviewRect(
  rect: { x: number; y: number; size: number },
  mapping: ReturnType<typeof getPreviewToImageMapping>,
) {
  const x = imageToPreviewX(rect.x, mapping);
  const y = imageToPreviewY(rect.y, mapping);
  const x2 = imageToPreviewX(rect.x + rect.size, mapping);
  const y2 = imageToPreviewY(rect.y + rect.size, mapping);

  return {
    x,
    y,
    size: Math.max(8, Math.min(Math.abs(x2 - x), Math.abs(y2 - y))),
  };
}

function cornerDarkRatio(
  rgba: Uint8Array,
  width: number,
  height: number,
  startX: number,
  startY: number,
  size: number,
): number {
  const x0 = clamp(Math.floor(startX), 0, width - 1);
  const y0 = clamp(Math.floor(startY), 0, height - 1);
  const x1 = clamp(Math.floor(startX + size), 0, width);
  const y1 = clamp(Math.floor(startY + size), 0, height);

  let dark = 0;
  let total = 0;

  const step = 2;
  for (let y = y0; y < y1; y += step) {
    for (let x = x0; x < x1; x += step) {
      const idx = (y * width + x) * 4;
      const r = rgba[idx];
      const g = rgba[idx + 1];
      const b = rgba[idx + 2];
      const luma = 0.299 * r + 0.587 * g + 0.114 * b;
      if (luma < LUMA_DARK_THRESHOLD) {
        dark += 1;
      }
      total += 1;
    }
  }

  return total === 0 ? 0 : dark / total;
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

import { useRef, useState } from 'react';
import { ActivityIndicator, Image, LayoutChangeEvent, Text, View } from 'react-native';
import { CameraType, CameraView, useCameraPermissions } from 'expo-camera';

import { ActionButton } from '../../../components/ui/ActionButton';

type FrameRect = {
    left: number;
    top: number;
    width: number;
    height: number;
};

export function CameraCapturePanel() {
    const [permission, requestPermission] = useCameraPermissions();
    const [facing, setFacing] = useState<CameraType>('back');
    const [isCapturing, setIsCapturing] = useState(false);
    const [lastPhotoUri, setLastPhotoUri] = useState<string | null>(null);
    const [previewSize, setPreviewSize] = useState({ width: 0, height: 0 });

    const cameraRef = useRef<CameraView | null>(null);

    const guideSize = 36;
    const guideThickness = 4;

    const toggleFacing = () => {
        setFacing((current) => (current === 'back' ? 'front' : 'back'));
    };

    const capturePhoto = async () => {
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
            }
        } catch {
            //
        } finally {
            setIsCapturing(false);
        }
    };

    const onPreviewLayout = (event: LayoutChangeEvent) => {
        const { width, height } = event.nativeEvent.layout;
        setPreviewSize({ width, height });
    };

    const frame = getA4Frame(previewSize.width, previewSize.height);

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
            <View
                className="h-full overflow-hidden rounded-xl border border-cyan-200/25 bg-black"
                onLayout={onPreviewLayout}
            >
                <CameraView ref={cameraRef} style={{ flex: 1 }} facing={facing} />

                <View pointerEvents="none" className="absolute inset-0">
                    <View
                        className="absolute left-0 right-0 top-0 bg-black/40 h-9"
                    />
                    <Text className="absolute left-4 right-4 top-2.5 text-center text-xs font-semibold text-cyan-100">
                        Move the sheet so marker squares sit on the corner guides
                    </Text>

                    {frame ? (
                        <>
                            <View
                                className="absolute rounded-2xl border border-cyan-300/35"
                                style={{
                                    left: frame.left,
                                    top: frame.top,
                                    width: frame.width,
                                    height: frame.height,
                                }}
                            />

                            <CornerGuide
                                corner="tl"
                                x={frame.left}
                                y={frame.top}
                                size={guideSize}
                                thickness={guideThickness}
                            />
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
                        </>
                    ) : null}
                </View>

                <View className="absolute bottom-0 w-full bg-black/45 p-3">
                    <View className="flex-row gap-2">
                        <View className="flex-1">
                            <ActionButton
                                label={isCapturing ? 'Capturing...' : 'Capture'}
                                onPress={capturePhoto}
                                disabled={isCapturing}
                            />
                        </View>
                        <View className="flex-1">
                            <ActionButton label="Flip Camera" variant="ghost" onPress={toggleFacing} />
                        </View>
                    </View>
                </View>
            </View>

            {lastPhotoUri ? (
                <View className="mt-3 rounded-xl border border-cyan-200/20 bg-[#0a1120]/80 p-2">
                    <Text className="mb-2 text-xs uppercase tracking-[1.5px] text-cyan-200/80">
                        Last Capture
                    </Text>
                    <Image source={{ uri: lastPhotoUri }} className="h-28 w-full rounded-lg" resizeMode="cover" />
                </View>
            ) : null}
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

    const a4Ratio = 210 / 297; // portrait width / height

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
    corner: 'tl' | 'tr' | 'bl' | 'br';
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
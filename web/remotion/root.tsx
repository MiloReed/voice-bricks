import { Composition, staticFile, type CalculateMetadataFunction } from "remotion";
import { classicBlocks, classicFinalBlock, defaultConfig } from "../lib/mock-data";
import {
  VIDEO_FPS,
  VIDEO_HEIGHT,
  VIDEO_WIDTH,
  VoiceBricksVideo,
  getVoiceBricksVideoDuration,
  type VoiceBricksVideoProps,
} from "./voice-bricks-video";

const defaultProps: VoiceBricksVideoProps = {
  config: defaultConfig,
  blocks: [...classicBlocks, classicFinalBlock],
  audioUrl: staticFile("demo-final.mp3"),
  qr: "",
};

const calculateMetadata: CalculateMetadataFunction<VoiceBricksVideoProps> = ({ props }) => ({
  durationInFrames: getVoiceBricksVideoDuration(props.blocks),
  defaultOutName: `${props.config.teamName || "voice-bricks"}-9x16.mp4`,
});

export function RemotionRoot() {
  return (
    <Composition
      id="VoiceBricksShare"
      component={VoiceBricksVideo}
      durationInFrames={getVoiceBricksVideoDuration(defaultProps.blocks)}
      fps={VIDEO_FPS}
      width={VIDEO_WIDTH}
      height={VIDEO_HEIGHT}
      defaultProps={defaultProps}
      calculateMetadata={calculateMetadata}
    />
  );
}

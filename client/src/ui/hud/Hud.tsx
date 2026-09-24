import { RaceStatus } from '../RaceStatus';
import { ExitButton } from '../ExitButton';
import { DirectionArrow } from './DirectionArrow';
import { SpeedGauge } from './SpeedGauge';
import { Minimap } from './Minimap';
import { MuteButton } from './MuteButton';
import { ControlsHint } from './ControlsHint';
import { FinishDeadline } from './FinishDeadline';
import { CameraToast } from './CameraToast';

/**
 * Poyga HUD'i:
 *  chap-tepa — o'rin, vaqt, tangalar | markaz-tepa — keyingi checkpointga yo'nalish
 *  o'ng-tepa — ovoz, chiqish | chap-past — mini-xarita | o'ng-past — tezlik, boost
 */
export function Hud() {
  return (
    <div className="hud">
      <RaceStatus />
      <DirectionArrow />
      <div className="hud-top-right">
        <MuteButton />
        <ExitButton />
      </div>
      <Minimap />
      <SpeedGauge />
      <ControlsHint />
      <FinishDeadline />
      <CameraToast />
    </div>
  );
}

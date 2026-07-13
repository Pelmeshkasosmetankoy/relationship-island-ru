import { Haptics, ImpactStyle } from '@capacitor/haptics';

// Native tactile feedback via the device's vibration motor. The Capacitor plugin
// talks to Android directly (reliable, unlike navigator.vibrate in the WebView)
// and falls back to the Web Vibration API on the web. Every call is fire-and-
// forget: any error (e.g. unsupported device) is swallowed.

export function tapFeedback() {
  Haptics.impact({ style: ImpactStyle.Light }).catch(() => { /* unsupported — ignore */ });
}

// A slightly stronger buzz for meaningful moments (a memory added, a purchase).
export function successFeedback() {
  Haptics.impact({ style: ImpactStyle.Medium }).catch(() => { /* unsupported — ignore */ });
}

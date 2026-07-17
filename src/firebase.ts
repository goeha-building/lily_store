import { getApp, getApps, initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider } from 'firebase/auth';
import {
  getFirestore,
  initializeFirestore,
  setLogLevel,
  type Firestore,
  type FirestoreSettings,
} from 'firebase/firestore';

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

const app = getApps().length ? getApp() : initializeApp(firebaseConfig);

if (import.meta.env.DEV) {
  setLogLevel('debug');
}

// `useFetchStreams`는 현재 SDK 런타임이 지원하지만 공개 타입에는 아직 포함되지 않았습니다.
type SchoolNetworkFirestoreSettings = FirestoreSettings & {
  useFetchStreams: boolean;
};

const schoolNetworkSettings: SchoolNetworkFirestoreSettings = {
  experimentalForceLongPolling: true,
  useFetchStreams: false,
};

// 학교 네트워크에서 Firestore의 기본 스트리밍 연결이 차단될 때를 대비합니다.
// HMR 재실행 시 이미 생성된 인스턴스는 그대로 재사용합니다.
let db: Firestore;
try {
  db = initializeFirestore(app, schoolNetworkSettings);
} catch {
  db = getFirestore(app);
}

export { app, db };
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();

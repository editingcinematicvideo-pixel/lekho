import { initializeApp, getApps, getApp } from 'firebase/app';
import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  sendPasswordResetEmail,
  signOut,
  onAuthStateChanged,
  updateProfile,
  User,
} from 'firebase/auth';
import {
  getFirestore,
  doc,
  getDoc,
  getDocFromServer,
  setDoc,
  updateDoc,
  deleteDoc,
  collection,
  getDocs,
  query,
  where,
  onSnapshot,
} from 'firebase/firestore';
import firebaseConfig from '../../firebase-applet-config.json';

// Initialize Firebase App singleton
const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);

// Initialize Auth & Google Provider
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({ prompt: 'select_account' });

// Initialize Cloud Firestore with provisioned database ID
export const firestoreDb = getFirestore(app, firebaseConfig.firestoreDatabaseId);

// Create a Firebase Auth user for an invited Staff member using an isolated secondary Firebase App
// so the currently logged-in Shop Owner's primary session is NEVER interrupted or signed out.
export async function createSecondaryStaffUser(
  email: string,
  passwordPlain: string,
  displayName?: string
): Promise<{ uid: string; email: string }> {
  const secondaryAppName = 'LekhoSecondaryStaffCreator';
  const existingSecondary = getApps().find((a) => a.name === secondaryAppName);
  const secondaryApp = existingSecondary || initializeApp(firebaseConfig, secondaryAppName);
  const secondaryAuth = getAuth(secondaryApp);

  const cred = await createUserWithEmailAndPassword(secondaryAuth, email.trim().toLowerCase(), passwordPlain);
  if (displayName) {
    await updateProfile(cred.user, { displayName: displayName.trim() }).catch(() => {});
  }
  const createdUid = cred.user.uid;
  const createdEmail = cred.user.email || email.trim().toLowerCase();
  await signOut(secondaryAuth).catch(() => {});
  return { uid: createdUid, email: createdEmail };
}

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId: string | undefined;
    email: string | null | undefined;
    emailVerified: boolean | undefined;
    isAnonymous: boolean | undefined;
    tenantId: string | null | undefined;
    providerInfo: {
      providerId: string;
      displayName: string | null;
      email: string | null;
      photoUrl: string | null;
    }[];
  };
}

export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null): never {
  const errorMsg = error instanceof Error ? error.message : String(error);
  const isOfflineOrNetwork =
    errorMsg.includes('client is offline') ||
    errorMsg.includes('unavailable') ||
    errorMsg.includes('network') ||
    errorMsg.includes('token-service-api-has-not-been-used');

  const errInfo: FirestoreErrorInfo = {
    error: errorMsg,
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo:
        auth.currentUser?.providerData?.map((provider) => ({
          providerId: provider.providerId,
          displayName: provider.displayName,
          email: provider.email,
          photoUrl: provider.photoURL,
        })) || [],
    },
    operationType,
    path,
  };
  if (isOfflineOrNetwork) {
    console.warn('Firestore offline status:', JSON.stringify(errInfo));
  } else {
    console.error('Firestore Error: ', JSON.stringify(errInfo));
  }
  throw new Error(JSON.stringify(errInfo));
}

// Verify connection to Firestore (Offline / Provisioning check)
export async function verifyFirestoreConnection(): Promise<boolean> {
  if (!auth.currentUser) return true;
  try {
    await getDocFromServer(doc(firestoreDb, 'users', auth.currentUser.uid));
    return true;
  } catch (error) {
    if (error instanceof Error && error.message.includes('the client is offline')) {
      console.warn('The Firestore client appears offline; falling back to local offline storage.');
    }
    return false;
  }
}

export {
  doc,
  getDoc,
  getDocFromServer,
  setDoc,
  updateDoc,
  deleteDoc,
  collection,
  getDocs,
  query,
  where,
  onSnapshot,
  signInWithPopup,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  sendPasswordResetEmail,
  signOut,
  onAuthStateChanged,
  updateProfile,
};
export type { User };

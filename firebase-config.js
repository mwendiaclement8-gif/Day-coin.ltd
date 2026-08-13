// ================================================================
// 🔥 FIREBASE CONFIGURATION
// ================================================================

// Replace these values with your own Firebase project settings
// Go to: Firebase Console → Project Settings → Your apps → Config
const firebaseConfig = {
    apiKey: "YOUR_API_KEY",
    authDomain: "YOUR_PROJECT_ID.firebaseapp.com",
    projectId: "YOUR_PROJECT_ID",
    storageBucket: "YOUR_PROJECT_ID.appspot.com",
    messagingSenderId: "YOUR_SENDER_ID",
    appId: "YOUR_APP_ID"
};

// ================================================================
// 🚀 INITIALIZE FIREBASE
// ================================================================

// Initialize Firebase
firebase.initializeApp(firebaseConfig);

// Initialize services
const auth = firebase.auth();
const db = firebase.firestore();

// Enable offline persistence for better performance
db.enablePersistence()
    .catch((err) => {
        console.warn('Firestore persistence error:', err);
    });

// ================================================================
// 🔐 AUTH STATE OBSERVER
// ================================================================

// Global variable to track user state
let currentUser = null;
let currentUserData = null;

// Listen for auth state changes
auth.onAuthStateChanged(async (user) => {
    if (user) {
        currentUser = user;
        console.log('✅ User signed in:', user.uid);
        
        // Load user data from Firestore
        try {
            const userDoc = await db.collection('users').doc(user.uid).get();
            if (userDoc.exists) {
                currentUserData = userDoc.data();
                console.log('📊 User data loaded:', currentUserData);
            }
        } catch (error) {
            console.error('Error loading user data:', error);
        }
        
        // Dispatch custom event for auth state change
        window.dispatchEvent(new CustomEvent('authStateChange', { 
            detail: { user, userData: currentUserData } 
        }));
        
    } else {
        currentUser = null;
        currentUserData = null;
        console.log('👋 User signed out');
        
        // Dispatch custom event
        window.dispatchEvent(new CustomEvent('authStateChange', { 
            detail: { user: null, userData: null } 
        }));
    }
});

// ================================================================
// 📝 AUTH FUNCTIONS
// ================================================================

// Register with email and password
async function registerUser(email, password, userData) {
    try {
        // Create user in Firebase Auth
        const userCredential = await auth.createUserWithEmailAndPassword(email, password);
        const user = userCredential.user;
        
        // Save user data to Firestore
        await db.collection('users').doc(user.uid).set({
            ...userData,
            uid: user.uid,
            email: email,
            walletBalance: 0,
            status: 'pending',
            createdAt: firebase.firestore.FieldValue.serverTimestamp(),
            updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        });
        
        // Create wallet document
        await db.collection('wallets').doc(user.uid).set({
            balance: 0,
            transactions: [],
            status: 'Normal',
            userId: user.uid,
            createdAt: firebase.firestore.FieldValue.serverTimestamp()
        });
        
        return { success: true, user };
    } catch (error) {
        console.error('Registration error:', error);
        return { success: false, error: error.message };
    }
}

// Login with email and password
async function loginUser(email, password) {
    try {
        const userCredential = await auth.signInWithEmailAndPassword(email, password);
        return { success: true, user: userCredential.user };
    } catch (error) {
        console.error('Login error:', error);
        return { success: false, error: error.message };
    }
}

// Google Sign-In
async function signInWithGoogle() {
    try {
        const provider = new firebase.auth.GoogleAuthProvider();
        const result = await auth.signInWithPopup(provider);
        return { success: true, user: result.user };
    } catch (error) {
        console.error('Google sign-in error:', error);
        return { success: false, error: error.message };
    }
}

// Logout
async function logoutUser() {
    try {
        await auth.signOut();
        return { success: true };
    } catch (error) {
        console.error('Logout error:', error);
        return { success: false, error: error.message };
    }
}

// Reset password
async function resetPassword(email) {
    try {
        await auth.sendPasswordResetEmail(email);
        return { success: true };
    } catch (error) {
        console.error('Password reset error:', error);
        return { success: false, error: error.message };
    }
}

// ================================================================
// 💰 WALLET FUNCTIONS
// ================================================================

// Get user wallet
async function getWallet(userId) {
    try {
        const walletDoc = await db.collection('wallets').doc(userId).get();
        if (walletDoc.exists) {
            return { success: true, data: walletDoc.data() };
        } else {
            // Create wallet if doesn't exist
            await db.collection('wallets').doc(userId).set({
                balance: 0,
                transactions: [],
                status: 'Normal',
                userId: userId,
                createdAt: firebase.firestore.FieldValue.serverTimestamp()
            });
            return { success: true, data: { balance: 0, transactions: [], status: 'Normal' } };
        }
    } catch (error) {
        console.error('Error getting wallet:', error);
        return { success: false, error: error.message };
    }
}

// Update wallet balance
async function updateWallet(userId, amount, type, description = '') {
    try {
        const walletRef = db.collection('wallets').doc(userId);
        
        await db.runTransaction(async (transaction) => {
            const doc = await transaction.get(walletRef);
            if (!doc.exists) {
                throw new Error('Wallet does not exist');
            }
            
            const currentBalance = doc.data().balance || 0;
            const newBalance = type === 'deposit' ? currentBalance + amount : currentBalance - amount;
            
            if (newBalance < 0) {
                throw new Error('Insufficient balance');
            }
            
            transaction.update(walletRef, { 
                balance: newBalance,
                updatedAt: firebase.firestore.FieldValue.serverTimestamp()
            });
            
            // Add transaction record
            const transactionRef = db.collection('transactions');
            transaction.set(transactionRef.doc(), {
                userId: userId,
                type: type,
                amount: amount,
                balance: newBalance,
                description: description,
                timestamp: firebase.firestore.FieldValue.serverTimestamp(),
                status: 'completed'
            });
        });
        
        return { success: true };
    } catch (error) {
        console.error('Wallet update error:', error);
        return { success: false, error: error.message };
    }
}

// ================================================================
// 📊 USER FUNCTIONS
// ================================================================

// Get user data
async function getUserData(userId) {
    try {
        const userDoc = await db.collection('users').doc(userId).get();
        if (userDoc.exists) {
            return { success: true, data: userDoc.data() };
        }
        return { success: false, error: 'User not found' };
    } catch (error) {
        console.error('Error getting user data:', error);
        return { success: false, error: error.message };
    }
}

// Update user data
async function updateUserData(userId, data) {
    try {
        await db.collection('users').doc(userId).update({
            ...data,
            updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        });
        return { success: true };
    } catch (error) {
        console.error('Error updating user data:', error);
        return { success: false, error: error.message };
    }
}

// Check if user is admin
async function isAdmin(userId) {
    try {
        const adminDoc = await db.collection('admins').doc(userId).get();
        return adminDoc.exists;
    } catch (error) {
        console.error('Error checking admin status:', error);
        return false;
    }
}

// ================================================================
// 🎮 GAME FUNCTIONS
// ================================================================

// Get all active games
async function getActiveGames() {
    try {
        const snapshot = await db.collection('games')
            .where('status', 'in', ['live', 'upcoming'])
            .orderBy('createdAt', 'desc')
            .get();
        
        const games = [];
        snapshot.forEach(doc => {
            games.push({ id: doc.id, ...doc.data() });
        });
        return { success: true, data: games };
    } catch (error) {
        console.error('Error getting games:', error);
        return { success: false, error: error.message };
    }
}

// Get live games
async function getLiveGames() {
    try {
        const snapshot = await db.collection('games')
            .where('status', '==', 'live')
            .orderBy('createdAt', 'desc')
            .get();
        
        const games = [];
        snapshot.forEach(doc => {
            games.push({ id: doc.id, ...doc.data() });
        });
        return { success: true, data: games };
    } catch (error) {
        console.error('Error getting live games:', error);
        return { success: false, error: error.message };
    }
}

// ================================================================
// 💬 SUPPORT FUNCTIONS
// ================================================================

// Create support ticket
async function createSupportTicket(userId, subject, message, userEmail) {
    try {
        await db.collection('support_tickets').add({
            userId: userId,
            subject: subject,
            message: message,
            userEmail: userEmail,
            status: 'open',
            timestamp: firebase.firestore.FieldValue.serverTimestamp(),
            updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        });
        return { success: true };
    } catch (error) {
        console.error('Error creating support ticket:', error);
        return { success: false, error: error.message };
    }
}

// ================================================================
// 📦 EXPORT FOR USE IN OTHER FILES
// ================================================================

// Make functions available globally
window.firebase = {
    auth,
    db,
    currentUser,
    currentUserData,
    registerUser,
    loginUser,
    signInWithGoogle,
    logoutUser,
    resetPassword,
    getWallet,
    updateWallet,
    getUserData,
    updateUserData,
    isAdmin,
    getActiveGames,
    getLiveGames,
    createSupportTicket
};

console.log('🔥 Firebase initialized successfully!');
console.log('📚 Available functions: registerUser, loginUser, signInWithGoogle, logoutUser, etc.');
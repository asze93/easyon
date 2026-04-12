/**
 * EASYON DIAMOND APP STATE (v86.8) 🧠💎
 * Centraliseret hukommelse for hele platformen.
 */

export const state = {
    supabaseClient: null,
    currentUser: null,
    currentView: 'landing',
    currentFirmaSettings: {},
    currentFirmaId: null,
    isGlobalAdmin: false,
    isSuperUser: false,
    authMode: 'login',
    
    // DIAMOND ELITE DATA STATE
    allCategories: [],
    allAssets: [],
    allLocations: [],
    selectedTaskTags: [],
    focusedSuggestionIndex: -1,
    sopSteps: [],
    currentSopId: null,
    currentStepId: null,
    profileLoading: false
};

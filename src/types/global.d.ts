/**
 * 萌力互动 · 全局类型声明
 */

// ===== API 客户端 =====
interface ApiAuth {
  login(email: string, password: string): Promise<{ token: string; user: any }>;
  logout(): Promise<void>;
  register(data: any): Promise<any>;
  me(): Promise<any>;
  updateProfile(data: any): Promise<any>;
}

interface ApiAdmin {
  listUsers(): Promise<any>;
  createUser(data: any): Promise<any>;
  updateUser(userId: string, data: any): Promise<any>;
  deleteUser(userId: string): Promise<any>;
  approveUser(userId: string): Promise<any>;
  rejectUser(userId: string): Promise<any>;
  toggleUser(userId: string): Promise<any>;
  getPermissions(userId: string): Promise<any>;
  updatePermissions(userId: string, featureKeys: string[]): Promise<any>;
  logAction(action: string, target?: string, details?: string): Promise<void>;
}

interface ApiPermissions {
  features(): Promise<any>;
  my(): Promise<any>;
}

interface ApiHistory {
  list(genType?: string, limit?: number): Promise<any>;
  create(data: any): Promise<any>;
  updateRating(id: number, rating: number): Promise<any>;
  softDelete(id: number): Promise<any>;
  getHighRated(genType?: string, limit?: number): Promise<any>;
}

interface ApiAssets {
  list(): Promise<any>;
  create(data: any): Promise<any>;
  updateRating(id: number, rating: number): Promise<any>;
  batchDelete(ids: number[]): Promise<any>;
}

interface ApiBrands {
  list(): Promise<any>;
  save(data: any): Promise<any>;
  delete(id: number): Promise<any>;
}

interface ApiTemplates {
  list(): Promise<any>;
  save(data: any): Promise<any>;
  delete(id: number): Promise<any>;
}

interface ApiPreferences {
  list(): Promise<any>;
  save(key: string, value: any): Promise<any>;
}

interface ApiFeedback {
  list(): Promise<any>;
  save(data: any): Promise<any>;
}

interface ApiPluginFeedback {
  list(): Promise<any>;
  submit(data: any): Promise<any>;
  updateStatus(id: number, status: string): Promise<any>;
  delete(id: number): Promise<any>;
}

interface ApiPlugins {
  list(): Promise<any>;
  get(id: number): Promise<any>;
  incrementDownload(id: number): Promise<any>;
  create(data: any): Promise<any>;
  update(id: number, data: any): Promise<any>;
  delete(id: number): Promise<any>;
}

interface ApiAi {
  copywriting(params: any): Promise<any>;
  streamCopywriting(params: any, onChunk: Function, onDone: Function, onError: Function): Promise<void>;
  imageEdit(params: any): Promise<any>;
  uploadImage(fileBase64: string, filename: string): Promise<any>;
  kolSearch(query: string, platform: string): Promise<any>;
  analyzeKol(images: any[]): Promise<any>;
  streamArticle(params: any, file: any, onChunk: Function, onDone: Function, onError: Function): Promise<void>;
  article(params: any, file?: any): Promise<any>;
  streamRefine(params: any, onChunk: Function, onDone: Function, onError: Function): Promise<void>;
  feedback(params: any): Promise<any>;
  createUser(data: any): Promise<any>;
}

interface ApiUpload {
  image(file: File): Promise<any>;
}

interface ApiClient {
  request(method: string, path: string, options?: any): Promise<any>;
  get(path: string, options?: any): Promise<any>;
  post(path: string, body?: any, options?: any): Promise<any>;
  put(path: string, body?: any, options?: any): Promise<any>;
  del(path: string, options?: any): Promise<any>;
  stream(path: string, body: any, onChunk: Function, onDone: Function, onError: Function): Promise<void>;

  auth: ApiAuth;
  admin: ApiAdmin;
  permissions: ApiPermissions;
  history: ApiHistory;
  assets: ApiAssets;
  brands: ApiBrands;
  templates: ApiTemplates;
  preferences: ApiPreferences;
  feedback: ApiFeedback;
  pluginFeedback: ApiPluginFeedback;
  plugins: ApiPlugins;
  ai: ApiAi;
  upload: ApiUpload;
}

// ===== 应用状态 =====
interface AppState {
  currentUser: any;
  userProfile: any;
  userPermissions: string[];
  allFeatures: any[];
  currentPage: string;
  currentPlatform: string;
  activeTag: string | null;
  kolList: any[];
  cart: any[];
  imgSize: string;
  imgMode: string;
  img2imgFiles: any[];
  maskEditorOpen: boolean;
  compareActive: boolean;
  _lastCopyText: string;
  _copyVersions: any[];
  _copyCurrentVersionIdx: number;
  _copyRootId: number | null;
  _copyEditMode: boolean;
  _lastArticleText: string;
  articleFiles: any[];
  articleMode: string;
  assets: any[];
  currentAssetTab: string;
  assetsPage: number;
  currentRatingFilter: number;
  batchMode: boolean;
  selectedAssets: any[];
  customBrands: any[];
  customTemplates: any[];
  pluginList: any[];
  currentPlugin: any;
  currentPluginChangelog: any[];
  pluginFeedbackType: string;
  feedbackImages: any[];
  analysisFiles: any[];
  analysisResult: any;
  lightboxGallery: any[];
  lightboxIndex: number;
  lightboxScale: number;
}

// ===== 全局变量 =====
declare const apiClient: ApiClient;
declare const appState: AppState;
declare function subscribeState(key: string, callback: (newVal: any, oldVal: any) => void): () => void;

// ===== Legacy 全局函数 =====
declare function showToast(msg: string, type?: string): void;
declare function renderMarkdown(text: string): string;
declare function escapeHtml(str: string): string;
declare function showPage(page: string): void;
declare function showLoginModal(): void;
declare function showRegisterModal(): void;
declare function handleLogin(user: any): Promise<void>;
declare function handleLogout(): void;
declare function isLoggedIn(): boolean;
declare function isAdmin(): boolean;
declare function hasPermission(featureKey: string): boolean;
declare function saveAsset(type: string, name: string, content: string): void;
declare function saveGenerationHistory(genType: string, inputParams: any, outputContent: string, rating?: number, extra?: any): Promise<number | null>;
declare function getHighRatedExamples(genType: string, limit?: number): Promise<any[]>;
declare function getUserBrands(): Promise<any[]>;
declare function saveUserTemplate(template: any): Promise<void>;
declare function savePreference(key: string, value: any): Promise<void>;
declare function createStarRating(containerId: string, historyId: number | null, content: string, genType: string): void;
declare function saveCurrentAsTemplate(): void;

// ===== CDN 库 =====
declare const marked: any;
declare const DOMPurify: any;
declare const validator: any;
declare const Notyf: any;
declare const JSZip: any;

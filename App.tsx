
import React, { useState, useRef, useEffect } from 'react';
import { generateGamerImage } from './services/geminiService';
import { GifGenerationState, AspectRatio } from './types';
import gifshot from 'gifshot';
import { 
  Sparkles, 
  Image as ImageIcon, 
  History, 
  ArrowRight,
  Upload,
  RefreshCcw,
  BadgePercent,
  Download,
  Sun,
  Moon,
  LogIn,
  LogOut,
  User as UserIcon,
  ShieldCheck
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { auth, db, OperationType, handleFirestoreError } from './services/firebase';
import { 
  onAuthStateChanged, 
  signInWithPopup, 
  GoogleAuthProvider, 
  signOut,
  User
} from 'firebase/auth';
import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';

const BEES_LOGO = "https://www.bees.com/themes/custom/abinbev_propel/bees-logo-black.svg";

const App: React.FC = () => {
  const heroInputRef = useRef<HTMLInputElement>(null);
  const [user, setUser] = useState<User | null>(null);
  const [authLoading, setAuthLoading] = useState(true);

  const INITIAL_STATE: Omit<GifGenerationState, 'history' | 'isDarkMode'> = {
    isLoading: false,
    error: null,
    gifUrl: null,
    heroImage: null,
    multiHeroImages: [],
    heroWidth: 350,
    heroHeight: 350,
    multiHeroSizes: [
      { w: 300, h: 450 },
      { w: 300, h: 450 },
      { w: 300, h: 450 },
      { w: 300, h: 450 }
    ],
    isMultiSku: false,
    text: "3%",
    topText: "Hasta",
    bottomText: "descuento",
    bgColor: "#00BAFF",
    textColor: "#000000",
    borderColor: "#FFFFFF",
  };

  const [gifState, setGifState] = useState<GifGenerationState>({
    ...INITIAL_STATE,
    isDarkMode: true,
    history: []
  });

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (u) => {
      setUser(u);
      setAuthLoading(false);
      
      if (u) {
        // Sync user to Firestore
        try {
          const userRef = doc(db, 'users', u.uid);
          await setDoc(userRef, {
            uid: u.uid,
            email: u.email,
            displayName: u.displayName,
            photoURL: u.photoURL,
            lastLogin: serverTimestamp()
          }, { merge: true });
        } catch (error) {
          console.error("Error syncing user:", error);
          // We don't block the app if sync fails, but we log it
        }
      }
    });
    return () => unsubscribe();
  }, []);

  const handleLogin = async () => {
    const provider = new GoogleAuthProvider();
    try {
      await signInWithPopup(auth, provider);
    } catch (error) {
      console.error("Login Error:", error);
    }
  };

  const handleLogout = async () => {
    try {
      await signOut(auth);
    } catch (error) {
      console.error("Logout Error:", error);
    }
  };

  const previewCanvasRef = useRef<HTMLCanvasElement>(null);

  const toggleTheme = () => {
    setGifState(p => ({ ...p, isDarkMode: !p.isDarkMode }));
  };

  const resetApp = () => {
    setGifState(p => ({
      ...INITIAL_STATE,
      isDarkMode: p.isDarkMode,
      history: p.history
    }));
  };

  const multiHeroInputRef = useRef<HTMLInputElement>(null);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        const img = new Image();
        img.onload = () => {
          const ratio = img.width / img.height;
          // Initial fit logic
          let w = 450;
          let h = w / ratio;
          if (h > 500) {
            h = 500;
            w = h * ratio;
          }
          setGifState(prev => ({ 
            ...prev, 
            heroImage: reader.result as string,
            heroWidth: Math.round(w),
            heroHeight: Math.round(h)
          }));
        };
        img.src = reader.result as string;
      };
      reader.readAsDataURL(file);
    }
  };

  const handleMultiFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files) {
      const newImages: string[] = [];
      const newSizes: {w: number, h: number}[] = [];
      
      const promises = Array.from(files).map((file: File) => {
        return new Promise<void>((resolve) => {
          const reader = new FileReader();
          reader.onloadend = () => {
            const img = new Image();
            img.onload = () => {
              const ratio = img.width / img.height;
              let w = 220;
              let h = w / ratio;
              newImages.push(reader.result as string);
              newSizes.push({ w: Math.round(w), h: Math.round(h) });
              resolve();
            };
            img.src = reader.result as string;
          };
          reader.readAsDataURL(file);
        });
      });
      
      Promise.all(promises).then(() => {
        setGifState(prev => {
          const updatedImages = [...prev.multiHeroImages, ...newImages].slice(0, 4);
          const updatedSizes = [...prev.multiHeroSizes];
          newImages.forEach((_, i) => {
             const targetIdx = prev.multiHeroImages.length + i;
             if (targetIdx < 4) updatedSizes[targetIdx] = newSizes[i];
          });
          return { ...prev, multiHeroImages: updatedImages, multiHeroSizes: updatedSizes };
        });
      });
    }
  };

  const renderFrame = (
    ctx: CanvasRenderingContext2D, 
    renderSize: number, 
    state: GifGenerationState, 
    isTextFrame: boolean, 
    images: HTMLImageElement[], 
    textImg: HTMLImageElement | null
  ) => {
    // 1. Fill entire canvas with the Border/Base Color (User wants to control the "white" part)
    ctx.fillStyle = state.borderColor || '#FFFFFF';
    ctx.fillRect(0, 0, renderSize, renderSize);
    
    // 2. Define Curvature and Margins
    const padding = 0; // Removing padding so the "border" fills the whole space if desired
    const borderRadius = 80;
    const borderThickness = 45; // Thickness for the inner container margin
    const innerPadding = borderThickness;
    const innerRadius = Math.max(0, borderRadius - borderThickness);

    // 4. Create CLIPPING MASK and draw BACKGROUND COLOR (The Inner Container)
    ctx.save();
    ctx.beginPath();
    ctx.roundRect(innerPadding, innerPadding, renderSize - (innerPadding * 2), renderSize - (innerPadding * 2), innerRadius);
    ctx.clip(); 
    
    ctx.fillStyle = state.bgColor;
    ctx.fillRect(0, 0, renderSize, renderSize);

    // 5. Draw Content
    if (isTextFrame) {
      if (textImg) ctx.drawImage(textImg, 0, 0);
    } else {
      // Draw Product(s)
      if (state.isMultiSku) {
        const count = images.length;
        if (count > 0) {
          const slotWidth = 320; 
          const gap = -215; 
          
          const totalWidth = count * slotWidth + (count - 1) * gap;
          const finalTotalWidth = totalWidth; // We use px directly now
          const startX = (renderSize - finalTotalWidth) / 2;
          
          images.forEach((img, i) => {
            const size = state.multiHeroSizes[i] || { w: 200, h: 300 };
            const dw = size.w;
            const dh = size.h;
            
            const x = startX + i * (slotWidth + gap);
            const y = (renderSize - dh) / 2;
            const offsetX = (slotWidth - dw) / 2;
            
            ctx.imageSmoothingEnabled = true;
            ctx.imageSmoothingQuality = 'high';
            ctx.drawImage(img, x + offsetX, y, dw, dh);
          });
        }
      } else if (images[0]) {
        const imgBottle = images[0];
        const dw = state.heroWidth;
        const dh = state.heroHeight;
        
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';
        ctx.drawImage(imgBottle, (renderSize - dw) / 2, (renderSize - dh) / 2, dw, dh);
      }
    }
    
    ctx.restore(); 
  };

  React.useEffect(() => {
    const updatePreview = async () => {
      const canvas = previewCanvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      const renderSize = 600;
      canvas.width = renderSize;
      canvas.height = renderSize;

      const loadPromises: Promise<HTMLImageElement>[] = [];
      const heroImagesToUse = gifState.isMultiSku ? gifState.multiHeroImages : (gifState.heroImage ? [gifState.heroImage] : []);

      heroImagesToUse.forEach(src => {
        loadPromises.push(new Promise((resolve) => {
          const img = new Image();
          img.onload = () => resolve(img);
          img.onerror = () => resolve(new Image());
          img.src = src;
        }));
      });

      const productImages = await Promise.all(loadPromises);
      const textUrl = await generateTextGraphic(gifState);
      const textImg = new Image();
      textImg.src = textUrl;
      
      textImg.onload = () => {
        renderFrame(ctx, renderSize, gifState, false, productImages, textImg);
      };
    };

    updatePreview();
  }, [gifState.heroImage, gifState.multiHeroImages, gifState.heroWidth, gifState.heroHeight, gifState.multiHeroSizes, gifState.isMultiSku, gifState.text, gifState.topText, gifState.bottomText, gifState.bgColor, gifState.textColor, gifState.borderColor]);

  const createAlternatingGIF = async (state: GifGenerationState): Promise<string> => {
    return new Promise((resolve, reject) => {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      if (!ctx) return reject('Canvas not supported');

      const renderSize = 600; 
      canvas.width = renderSize;
      canvas.height = renderSize;

      const imgText = new Image();
      const imagesToLoad: HTMLImageElement[] = [];
      
      const heroImagesToUse = state.isMultiSku ? state.multiHeroImages : [state.heroImage!];

      // Load all necessary images
      const loadPromises: Promise<void>[] = [];

      // 1. Text frame (Pre-generated locally)
      loadPromises.push(new Promise((res) => {
        imgText.onload = () => res();
        generateTextGraphic(state).then(url => imgText.src = url);
      }));

      // 2. Product images
      heroImagesToUse.forEach((src) => {
        const img = new Image();
        img.crossOrigin = "anonymous";
        imagesToLoad.push(img);
        loadPromises.push(new Promise((res) => {
          img.onload = () => res();
          img.onerror = () => res(); // Skip broken images
          img.src = src;
        }));
      });
      
      Promise.all(loadPromises).then(() => {
        const frames: string[] = [];
        
        const textImgHtml = imgText;
        const productImgsHtml = imagesToLoad;

        frames.push((() => {
          renderFrame(ctx, renderSize, state, true, productImgsHtml, textImgHtml);
          return canvas.toDataURL('image/png');
        })());

        frames.push((() => {
          renderFrame(ctx, renderSize, state, false, productImgsHtml, textImgHtml);
          return canvas.toDataURL('image/png');
        })());

        gifshot.createGIF({
          images: frames,
          interval: 1.0, 
          gifWidth: 150,
          gifHeight: 150,
          sampleInterval: 1,
          numFrames: 2,
          repeat: 0
        }, (obj: any) => {
          if (!obj.error) {
            resolve(obj.image);
          } else {
            reject(obj.errorMsg);
          }
        });
      }).catch(reject);
    });
  };

  const generateTextGraphic = async (state: GifGenerationState): Promise<string> => {
    return new Promise((resolve) => {
      const canvas = document.createElement('canvas');
      const size = 600; 
      canvas.width = size;
      canvas.height = size;
      const ctx = canvas.getContext('2d');
      if (!ctx) return resolve('');

      // Wait for fonts to be ready
      document.fonts.ready.then(() => {
        // Setup Text Style
        ctx.fillStyle = state.textColor;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        
        const mainFont = '"Barlow Semi Condensed"';
        
        // Calculate dynamic sizes (MAX Presence)
        const middleHeight = 220;
        const subHeight = 95;
        const spacing = 12;

        ctx.font = `900 ${subHeight}px ${mainFont}`;
        ctx.fillText(state.topText, size / 2, size / 2 - middleHeight / 2 - subHeight / 2 + spacing);

        let currentMiddleSize = middleHeight;
        ctx.font = `900 ${currentMiddleSize}px ${mainFont}`;
        const metrics = ctx.measureText(state.text);
        const safeArea = size - (15 + 30) * 2 - 20;
        if (metrics.width > safeArea) {
           currentMiddleSize = middleHeight * (safeArea / metrics.width);
           ctx.font = `900 ${currentMiddleSize}px ${mainFont}`;
        }
        ctx.fillText(state.text, size / 2, size / 2 + 5);

        ctx.font = `900 ${subHeight}px ${mainFont}`;
        ctx.fillText(state.bottomText, size / 2, size / 2 + (middleHeight / 2) + (subHeight / 2) - spacing);

        resolve(canvas.toDataURL('image/png'));
      });
    });
  };

  const handleGenerateGif = async () => {
    if (!gifState.isMultiSku && !gifState.heroImage) return;
    if (gifState.isMultiSku && gifState.multiHeroImages.length === 0) return;

    setGifState(prev => ({ ...prev, isLoading: true, error: null }));
    try {
      const gifUrl = await createAlternatingGIF(gifState);

      setGifState(prev => ({ 
        ...prev, 
        gifUrl: gifUrl, 
        isLoading: false,
        history: [gifUrl, ...prev.history].slice(0, 10)
      }));
    } catch (err: any) {
      setGifState(prev => ({ ...prev, error: err.message, isLoading: false }));
    }
  };

  return (
    <div className={`min-h-screen transition-colors duration-500 font-sans ${gifState.isDarkMode ? 'bg-neutral-950 text-neutral-100 selection:bg-amber-500/30' : 'bg-neutral-50 text-neutral-900 selection:bg-amber-500/20'}`}>
      
      {/* Header Snippet Migration */}
      <header className={`${gifState.isDarkMode ? 'bg-[#1A1A1A] border-neutral-800' : 'bg-white border-neutral-200'} border-b px-6 py-4 flex items-center justify-between sticky top-0 z-50 shadow-sm transition-colors duration-500`}>
        <div className="flex items-center gap-3">
          <img 
            src={BEES_LOGO} 
            alt="BEES Logo" 
            className={`h-7 w-auto transition-all ${gifState.isDarkMode ? 'brightness-0 invert' : ''}`} 
            referrerPolicy="no-referrer" 
            onError={(e) => {
              (e.target as HTMLImageElement).src = "https://logos-world.net/wp-content/uploads/2023/12/Bees-Logo.png";
            }}
          />
          <div className={`h-8 w-[1px] ${gifState.isDarkMode ? 'bg-neutral-700' : 'bg-neutral-300'} mx-2`} />
          <h1 className="text-2xl font-bold tracking-tight text-amber-500">
            SlideUp<span className={gifState.isDarkMode ? 'text-white' : 'text-neutral-900'}>Generator</span>
          </h1>
          <div className={`h-8 w-[1px] ${gifState.isDarkMode ? 'bg-neutral-700' : 'bg-neutral-300'} mx-2`} />
          <img 
            src="https://cdn.prod.website-files.com/60a4d4a53dd0c3f45579ac64/66853b2209a78da3e37b4f87_Vector.svg" 
            alt="Braze Logo" 
            className={`h-7 w-auto transition-all ${gifState.isDarkMode ? 'brightness-0 invert' : ''}`} 
            referrerPolicy="no-referrer"
            onError={(e) => {
              (e.target as HTMLImageElement).src = "https://www.svgrepo.com/download/353508/braze.svg";
            }}
          />
        </div>

        <div className="flex items-center gap-4">
          {user && (
            <div className="flex items-center gap-3 pr-2 mr-2 border-r border-neutral-700/50">
              <div className="text-right hidden sm:block">
                <p className={`text-[10px] font-bold leading-tight ${gifState.isDarkMode ? 'text-white' : 'text-neutral-900'}`}>{user.displayName}</p>
                <p className="text-[9px] text-neutral-500 font-medium">Bavaria Col</p>
              </div>
              {user.photoURL ? (
                <img src={user.photoURL} alt={user.displayName || ""} className="w-8 h-8 rounded-full border border-amber-500/30" />
              ) : (
                <div className="w-8 h-8 rounded-full bg-neutral-800 flex items-center justify-center border border-amber-500/30">
                  <UserIcon className="w-4 h-4 text-amber-500" />
                </div>
              )}
              <button 
                onClick={handleLogout}
                className={`p-2 rounded-lg transition-colors ${gifState.isDarkMode ? 'hover:bg-neutral-800 text-neutral-400' : 'hover:bg-neutral-100 text-neutral-500'}`}
                title="Cerrar sesión"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          )}

          <button 
            onClick={resetApp}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${gifState.isDarkMode ? 'bg-amber-500 text-black hover:bg-amber-400 shadow-[0_0_20px_rgba(245,158,11,0.1)]' : 'bg-neutral-900 text-white hover:bg-black shadow-lg'}`}
          >
            <RefreshCcw className="w-3 h-3" />
            Nueva Creación
          </button>

          <div className={`hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-lg border text-[9px] font-black uppercase tracking-widest ${gifState.isDarkMode ? 'bg-neutral-950 border-neutral-800 text-neutral-500' : 'bg-neutral-50 border-neutral-200 text-neutral-400'}`}>
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
            Active v2.5
          </div>
          
          <button 
            onClick={toggleTheme}
            className={`p-2.5 rounded-xl border transition-all duration-300 ${gifState.isDarkMode ? 'bg-neutral-900 border-neutral-800 text-amber-500 hover:bg-neutral-800' : 'bg-white border-neutral-200 text-neutral-600 shadow-sm hover:border-amber-500/50 hover:text-amber-600'}`}
          >
            {gifState.isDarkMode ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
          </button>
        </div>
      </header>

      <div className="max-w-6xl mx-auto px-4 py-8 md:py-12">
        {authLoading ? (
          <div className="flex flex-col items-center justify-center min-h-[60vh] space-y-4">
             <div className="w-12 h-12 border-2 border-amber-500/10 border-t-amber-500 rounded-full animate-spin" />
             <p className="text-[10px] font-black uppercase tracking-[0.3em] text-neutral-500">Checking Access</p>
          </div>
        ) : !user ? (
          <div className="flex flex-col items-center justify-center min-h-[60vh] max-w-md mx-auto text-center space-y-8 animate-in fade-in zoom-in duration-500">
            <div className={`p-10 rounded-[3rem] border transition-all ${gifState.isDarkMode ? 'bg-neutral-900 border-neutral-800' : 'bg-white border-neutral-100 shadow-2xl'}`}>
              <div className="w-20 h-20 bg-amber-500 rounded-3xl mx-auto mb-8 flex items-center justify-center shadow-[0_20px_50px_rgba(245,158,11,0.2)]">
                <ShieldCheck className="w-10 h-10 text-black" />
              </div>
              <h2 className={`text-3xl font-black tracking-tighter mb-2 ${gifState.isDarkMode ? 'text-white' : 'text-neutral-900'}`}>
                SlideUp<span className="text-amber-500">Generator</span>
              </h2>
              <p className="text-neutral-500 text-xs font-bold uppercase tracking-widest mb-10 leading-relaxed">
                Herramienta Exclusiva Bavaria <br/>
                <span className="text-[9px] opacity-50">BEES Platform Edition</span>
              </p>
              <button 
                onClick={handleLogin}
                className="w-full flex items-center justify-center gap-3 bg-neutral-950 text-white hover:bg-black py-4 rounded-2xl font-black uppercase tracking-widest transition-all shadow-xl active:scale-95 group"
              >
                <LogIn className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                Ingresar con Google
              </button>
            </div>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-start">
          
          {/* Controls */}
          <div className="lg:col-span-4 space-y-8">
            <div className={`${gifState.isDarkMode ? 'bg-neutral-900 border-neutral-800' : 'bg-white border-neutral-200 shadow-xl'} border p-8 rounded-[2rem] space-y-8 transition-colors duration-500`}>
              
              {/* SKU Mode Selection */}
              <div className="space-y-4">
                <label className={`block text-[10px] font-black uppercase tracking-widest ${gifState.isDarkMode ? 'text-neutral-500' : 'text-neutral-400'}`}>
                  Configuración de Producto
                </label>
                <div className={`grid grid-cols-2 gap-2 p-1 rounded-xl border ${gifState.isDarkMode ? 'bg-neutral-950 border-neutral-800' : 'bg-neutral-50 border-neutral-200'}`}>
                  <button 
                    onClick={() => setGifState(p => ({ ...p, isMultiSku: false }))}
                    className={`py-2 text-[10px] font-bold uppercase rounded-lg transition-all ${!gifState.isMultiSku ? 'bg-amber-500 text-black shadow-lg' : 'text-neutral-500 hover:text-neutral-300'}`}
                  >
                    Un Solo SKU
                  </button>
                  <button 
                    onClick={() => setGifState(p => ({ ...p, isMultiSku: true }))}
                    className={`py-2 text-[10px] font-bold uppercase rounded-lg transition-all ${gifState.isMultiSku ? 'bg-amber-500 text-black shadow-lg' : 'text-neutral-500 hover:text-neutral-300'}`}
                  >
                    Varios SKUs
                  </button>
                </div>
              </div>

              {/* Asset Upload */}
              <div className="space-y-4">
                <label className={`block text-[10px] font-black uppercase tracking-widest ${gifState.isDarkMode ? 'text-neutral-500' : 'text-neutral-400'}`}>
                  1. {gifState.isMultiSku ? 'Botellas / Hero Assets (Máx 4)' : 'Botella / Hero Asset'}
                </label>
                
                {!gifState.isMultiSku ? (
                  <div 
                    onClick={() => heroInputRef.current?.click()}
                    className={`group relative aspect-square rounded-2xl border-2 border-dashed transition-all cursor-pointer overflow-hidden flex flex-col items-center justify-center
                      ${gifState.isDarkMode ? 'bg-neutral-950 border-neutral-800 hover:border-amber-500/50' : 'bg-neutral-50 border-neutral-200 hover:border-amber-500/50'}
                      ${gifState.heroImage ? 'border-amber-500/30' : ''}`}
                  >
                    <input type="file" ref={heroInputRef} className="hidden" accept="image/*" onChange={handleFileUpload} />
                    {gifState.heroImage ? (
                      <>
                        <img src={gifState.heroImage} className="w-full h-full object-contain p-4" alt="Hero" />
                        <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                          <Upload className="w-5 h-5 text-white" />
                        </div>
                        {/* PX Controls for Single SKU */}
                        <div className="absolute bottom-4 left-4 right-4 bg-black/80 backdrop-blur-md rounded-2xl p-4 translate-y-4 opacity-0 group-hover:translate-y-0 group-hover:opacity-100 transition-all border border-white/10">
                          <p className="text-[10px] font-black uppercase text-amber-500 mb-3 tracking-widest text-center">Dimensiones (PX)</p>
                          <div className="grid grid-cols-2 gap-3">
                            <div className="space-y-1">
                              <span className="text-[7px] font-black uppercase text-neutral-500">Ancho</span>
                              <input 
                                type="number" 
                                value={gifState.heroWidth} 
                                onClick={(e) => e.stopPropagation()}
                                onChange={(e) => setGifState(p => ({ ...p, heroWidth: parseInt(e.target.value) || 0 }))}
                                className="w-full bg-neutral-900 border border-neutral-700 rounded-lg px-2 py-1 text-white text-[10px] font-bold outline-none focus:border-amber-500"
                              />
                            </div>
                            <div className="space-y-1">
                              <span className="text-[7px] font-black uppercase text-neutral-500">Alto</span>
                              <input 
                                type="number" 
                                value={gifState.heroHeight} 
                                onClick={(e) => e.stopPropagation()}
                                onChange={(e) => setGifState(p => ({ ...p, heroHeight: parseInt(e.target.value) || 0 }))}
                                className="w-full bg-neutral-900 border border-neutral-700 rounded-lg px-2 py-1 text-white text-[10px] font-bold outline-none focus:border-amber-500"
                              />
                            </div>
                          </div>
                        </div>
                      </>
                    ) : (
                      <div className="text-center space-y-2">
                        <ImageIcon className={`w-6 h-6 mx-auto ${gifState.isDarkMode ? 'text-neutral-700' : 'text-neutral-300'}`} />
                        <span className={`text-[10px] font-bold block uppercase ${gifState.isDarkMode ? 'text-neutral-600' : 'text-neutral-400'}`}>Subir Botella</span>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-3">
                      {gifState.multiHeroImages.map((img, i) => (
                        <div key={i} className={`relative aspect-square rounded-xl overflow-hidden group border ${gifState.isDarkMode ? 'bg-neutral-950 border-neutral-800' : 'bg-neutral-50 border-neutral-100'}`}>
                          <img src={img} className="w-full h-full object-contain p-2" alt={`SKU ${i}`} />
                          
                          {/* Individual PX Size for Multi SKU */}
                          <div className="absolute inset-0 bg-black/90 backdrop-blur-sm p-4 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col justify-center gap-3">
                            <p className="text-[8px] font-black uppercase text-amber-500 tracking-widest text-center">Medidas PX</p>
                            <div className="space-y-2">
                              <div className="flex items-center justify-between gap-2">
                                <span className="text-[7px] font-bold text-neutral-400 uppercase">W</span>
                                <input 
                                  type="number" 
                                  value={gifState.multiHeroSizes[i]?.w} 
                                  onChange={(e) => {
                                    const newSizes = [...gifState.multiHeroSizes];
                                    newSizes[i] = { ...newSizes[i], w: parseInt(e.target.value) || 0 };
                                    setGifState(p => ({ ...p, multiHeroSizes: newSizes }));
                                  }}
                                  className="w-16 bg-neutral-800 border border-neutral-700 rounded-md px-1 py-0.5 text-white text-[9px] font-bold"
                                />
                              </div>
                              <div className="flex items-center justify-between gap-2">
                                <span className="text-[7px] font-bold text-neutral-400 uppercase">H</span>
                                <input 
                                  type="number" 
                                  value={gifState.multiHeroSizes[i]?.h} 
                                  onChange={(e) => {
                                    const newSizes = [...gifState.multiHeroSizes];
                                    newSizes[i] = { ...newSizes[i], h: parseInt(e.target.value) || 0 };
                                    setGifState(p => ({ ...p, multiHeroSizes: newSizes }));
                                  }}
                                  className="w-16 bg-neutral-800 border border-neutral-700 rounded-md px-1 py-0.5 text-white text-[9px] font-bold"
                                />
                              </div>
                            </div>
                          </div>

                          <button 
                            onClick={() => setGifState(p => ({ ...p, multiHeroImages: p.multiHeroImages.filter((_, idx) => idx !== i) }))}
                            className="absolute top-1 right-1 w-5 h-5 bg-red-500 text-white rounded-full text-[10px] opacity-0 group-hover:opacity-100 transition-opacity"
                          >
                            ×
                          </button>
                        </div>
                      ))}
                      {gifState.multiHeroImages.length < 4 && (
                        <div 
                          onClick={() => multiHeroInputRef.current?.click()}
                          className={`aspect-square rounded-xl border-2 border-dashed transition-all cursor-pointer flex flex-col items-center justify-center ${gifState.isDarkMode ? 'bg-neutral-950 border-neutral-800 hover:border-amber-500/50' : 'bg-neutral-50 border-neutral-200 hover:border-amber-500/50'}`}
                        >
                          <input type="file" ref={multiHeroInputRef} className="hidden" accept="image/*" multiple onChange={handleMultiFileUpload} />
                          <Upload className={`w-4 h-4 ${gifState.isDarkMode ? 'text-neutral-700' : 'text-neutral-300'}`} />
                          <span className={`text-[8px] font-bold mt-1 uppercase ${gifState.isDarkMode ? 'text-neutral-600' : 'text-neutral-400'}`}>Añadir</span>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>

              {/* Text Input Block */}
              <div className="space-y-6">
                <label className={`block text-[10px] font-black uppercase tracking-widest ${gifState.isDarkMode ? 'text-neutral-500' : 'text-neutral-400'}`}>
                  2. Configuración de Texto (Descuento o Precio)
                </label>
                
                <div className="space-y-4">
                  <div>
                    <span className={`text-[9px] font-bold block uppercase mb-2 ${gifState.isDarkMode ? 'text-neutral-600' : 'text-neutral-400'}`}>Línea Superior (Ejem: Hasta / Llévalo desde)</span>
                    <input 
                      type="text" 
                      value={gifState.topText}
                      onChange={(e) => setGifState(p => ({ ...p, topText: e.target.value }))}
                      className={`w-full border rounded-xl px-4 py-3 font-bold text-xs outline-none transition-all ${gifState.isDarkMode ? 'bg-neutral-950 border-neutral-800 text-white focus:ring-amber-500' : 'bg-neutral-50 border-neutral-200 text-neutral-900 focus:ring-amber-500'}`}
                      placeholder="Ejem: ¡Nuevo sabor! / Llévalo desde"
                    />
                  </div>

                  <div>
                    <span className={`text-[9px] font-bold block uppercase mb-2 ${gifState.isDarkMode ? 'text-neutral-600' : 'text-neutral-400'}`}>Texto Central (El Protagonista)</span>
                    <input 
                      type="text" 
                      value={gifState.text}
                      onChange={(e) => setGifState(p => ({ ...p, text: e.target.value }))}
                      className={`w-full border rounded-xl px-4 py-4 font-black text-xl outline-none transition-all ${gifState.isDarkMode ? 'bg-neutral-950 border-neutral-800 text-white focus:ring-amber-500' : 'bg-neutral-50 border-neutral-200 text-neutral-900 focus:ring-amber-500'}`}
                      placeholder="Ejem: 3% / $10.000"
                    />
                  </div>

                  <div>
                    <span className={`text-[9px] font-bold block uppercase mb-2 ${gifState.isDarkMode ? 'text-neutral-600' : 'text-neutral-400'}`}>Línea Inferior (Ejem: descuento / sixpack)</span>
                    <input 
                      type="text" 
                      value={gifState.bottomText}
                      onChange={(e) => setGifState(p => ({ ...p, bottomText: e.target.value }))}
                      className={`w-full border rounded-xl px-4 py-3 font-bold text-xs outline-none transition-all ${gifState.isDarkMode ? 'bg-neutral-950 border-neutral-800 text-white focus:ring-amber-500' : 'bg-neutral-50 border-neutral-200 text-neutral-900 focus:ring-amber-500'}`}
                      placeholder="Ejem: de descuento / por sixpack"
                    />
                  </div>
                </div>
              </div>

              {/* Color Inputs Grid */}
              <div className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Color Input */}
                  <div className="space-y-4">
                    <label className={`block text-[10px] font-black uppercase tracking-widest ${gifState.isDarkMode ? 'text-neutral-500' : 'text-neutral-400'}`}>
                      3. Color del Contenedor (Interior)
                    </label>
                    <div className="flex gap-2">
                      <input 
                        type="color" 
                        value={gifState.bgColor.length === 7 ? gifState.bgColor : "#00BAFF"}
                        onChange={(e) => setGifState(p => ({ ...p, bgColor: e.target.value.toUpperCase() }))}
                        className={`w-10 h-10 rounded-lg border p-1 cursor-pointer shrink-0 ${gifState.isDarkMode ? 'bg-neutral-950 border-neutral-800' : 'bg-white border-neutral-200'}`}
                      />
                      <input 
                        type="text" 
                        value={gifState.bgColor}
                        onChange={(e) => setGifState(p => ({ ...p, bgColor: e.target.value }))}
                        className={`w-full border rounded-lg px-2 py-1 font-mono text-[10px] outline-none ${gifState.isDarkMode ? 'bg-neutral-950 border-neutral-800 text-white' : 'bg-white border-neutral-200 text-neutral-900'}`}
                        placeholder="#00BAFF"
                      />
                    </div>
                  </div>

                  {/* Text Color Input */}
                  <div className="space-y-4">
                    <label className={`block text-[10px] font-black uppercase tracking-widest ${gifState.isDarkMode ? 'text-neutral-500' : 'text-neutral-400'}`}>
                      4. Color del Texto (HEX)
                    </label>
                    <div className="flex gap-2">
                      <input 
                        type="color" 
                        value={gifState.textColor.length === 7 ? gifState.textColor : "#000000"}
                        onChange={(e) => setGifState(p => ({ ...p, textColor: e.target.value.toUpperCase() }))}
                        className={`w-10 h-10 rounded-lg border p-1 cursor-pointer shrink-0 ${gifState.isDarkMode ? 'bg-neutral-950 border-neutral-800' : 'bg-white border-neutral-200'}`}
                      />
                      <input 
                        type="text" 
                        value={gifState.textColor}
                        onChange={(e) => setGifState(p => ({ ...p, textColor: e.target.value }))}
                        className={`w-full border rounded-lg px-2 py-1 font-mono text-[10px] outline-none ${gifState.isDarkMode ? 'bg-neutral-950 border-neutral-800 text-white' : 'bg-white border-neutral-200 text-neutral-900'}`}
                        placeholder="#000000"
                      />
                    </div>
                  </div>
                </div>

                {/* Border Color Input */}
                <div className="space-y-4">
                  <label className={`block text-[10px] font-black uppercase tracking-widest ${gifState.isDarkMode ? 'text-neutral-500' : 'text-neutral-400'}`}>
                    5. Color de Fondo (Exterior)
                  </label>
                  <div className="flex gap-2">
                    <input 
                      type="color" 
                      value={gifState.borderColor.length === 7 ? gifState.borderColor : "#FFFFFF"}
                      onChange={(e) => setGifState(p => ({ ...p, borderColor: e.target.value.toUpperCase() }))}
                      className={`w-10 h-10 rounded-lg border p-1 cursor-pointer shrink-0 ${gifState.isDarkMode ? 'bg-neutral-950 border-neutral-800' : 'bg-white border-neutral-200'}`}
                    />
                    <input 
                      type="text" 
                      value={gifState.borderColor}
                      onChange={(e) => setGifState(p => ({ ...p, borderColor: e.target.value }))}
                      className={`w-full border rounded-lg px-2 py-1 font-mono text-[10px] outline-none ${gifState.isDarkMode ? 'bg-neutral-950 border-neutral-800 text-white' : 'bg-white border-neutral-200 text-neutral-900'}`}
                      placeholder="#FFFFFF"
                    />
                  </div>
                </div>
              </div>

              {/* Action Button */}
              <button 
                onClick={handleGenerateGif}
                disabled={gifState.isLoading || (!gifState.heroImage && !gifState.isMultiSku) || (gifState.isMultiSku && gifState.multiHeroImages.length === 0)}
                className={`w-full py-4 rounded-2xl font-black uppercase tracking-widest transition-all active:scale-95 disabled:opacity-20 flex items-center justify-center gap-3 ${gifState.isDarkMode ? 'bg-white text-black hover:bg-neutral-200 shadow-lg' : 'bg-neutral-900 text-white hover:bg-black shadow-xl'}`}
              >
                {gifState.isLoading ? (
                  <RefreshCcw className="w-5 h-5 animate-spin" />
                ) : (
                  <>
                    <Sparkles className="w-4 h-4 fill-current" />
                    Generar GIF
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Preview */}
          <div className="lg:col-span-8 flex flex-col gap-8">
            <div className={`aspect-square border rounded-[2.5rem] overflow-hidden relative flex items-center justify-center transition-all duration-500 ${gifState.isDarkMode ? 'bg-neutral-900 border-neutral-800 shadow-2xl' : 'bg-white border-neutral-200 shadow-xl'}`}>
              
              {/* LIVE PREVIEW CANVAS */}
              <canvas 
                ref={previewCanvasRef} 
                className={`absolute inset-0 w-full h-full object-contain p-4 z-0 transition-opacity duration-300 ${gifState.isLoading ? 'opacity-20' : 'opacity-100'}`}
              />

              {gifState.isLoading ? (
                <div className="text-center space-y-6 z-10">
                  <div className="relative inline-block">
                    <div className="w-20 h-20 border-2 border-amber-500/10 border-t-amber-500 rounded-full animate-spin"></div>
                    <BadgePercent className="w-6 h-6 text-amber-500 absolute inset-0 m-auto" />
                  </div>
                  <div className="space-y-1">
                    <p className={`text-xs font-black uppercase tracking-[0.4em] ${gifState.isDarkMode ? 'text-white' : 'text-neutral-900'}`}>Rendering Loop</p>
                    <p className="text-[9px] text-neutral-500 font-bold uppercase tracking-widest">1s Interval Activation...</p>
                  </div>
                </div>
              ) : gifState.gifUrl ? (
                <>
                  <motion.img 
                    key={gifState.gifUrl}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    src={gifState.gifUrl} 
                    alt="Result" 
                    className="w-full h-full object-contain p-4 z-10 bg-inherit" 
                  />
                  <div className="absolute bottom-8 right-8 z-20">
                    <a 
                      href={gifState.gifUrl} 
                      download={`slideup-${gifState.text}.gif`}
                      className={`px-6 py-3 rounded-full text-[10px] font-black uppercase tracking-widest flex items-center gap-2 hover:scale-105 transition-all shadow-2xl ${gifState.isDarkMode ? 'bg-white text-black' : 'bg-neutral-900 text-white'}`}
                    >
                      <Download className="w-3 h-3" /> Descargar 
                    </a>
                  </div>
                </>
              ) : null}
            </div>

            {/* History Small */}
            {gifState.history.length > 0 && (
              <div className="space-y-4">
                <h3 className={`text-[10px] font-black uppercase tracking-widest flex items-center gap-2 ${gifState.isDarkMode ? 'text-neutral-600' : 'text-neutral-400'}`}>
                  <History className="w-3 h-3" /> Recent Animations
                </h3>
                <div className="flex gap-4 overflow-x-auto pb-4 scrollbar-hide">
                  {gifState.history.map((url, i) => (
                    <div 
                      key={i} 
                      onClick={() => setGifState(p => ({ ...p, gifUrl: url }))}
                      className={`w-32 aspect-square flex-shrink-0 rounded-xl border cursor-pointer hover:border-amber-500/50 transition-all overflow-hidden ${gifState.isDarkMode ? 'bg-neutral-900 border-neutral-800' : 'bg-white border-neutral-200 shadow-md'}`}
                    >
                      <img src={url} className="w-full h-full object-contain p-2" alt="History" />
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

        </div>

        <footer>
          <p className="text-[10px] text-neutral-500 font-bold uppercase tracking-widest leading-relaxed">
            Standard: 150x150px • 1.0s Loop • {gifState.bgColor}
          </p>
        </footer>
        </>
        )}
      </div>
    </div>
  );
};

export default App;

import { motion } from 'framer-motion'
import { useRef, useEffect, useState } from 'react'

interface PopupVideoProps {
  src: string
  x: number
  y: number
  onClose?: () => void
  showCloseButton?: boolean
  autoCloseOnEnd?: boolean
  loop?: boolean
}

// ✅ 直接在這裡判斷裝置
function shouldMuteVideo(): boolean {
  const ua = window.navigator.userAgent.toLowerCase();
  const platform = window.navigator.platform.toLowerCase();

  // 檢查 iOS (iPhone, iPad, iPod)
  const isIOS = /iphone|ipad|ipod/.test(ua) ||
                /iphone|ipad|ipod/.test(platform) ||
                (platform === 'macintel' && navigator.maxTouchPoints > 1); // iPad iOS 13+

  // 檢查 Android
  const isAndroid = /android/.test(ua);

  return isIOS || isAndroid;
}

export function PopupVideo({
  src,
  x,
  y,
  onClose,
  showCloseButton = false,
  autoCloseOnEnd = false,
  loop = false
}: PopupVideoProps) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const [isMobile] = useState(window.innerWidth < 600)

  // ✅ 根據裝置決定是否靜音
  const shouldMute = shouldMuteVideo()

  // 確保位置不會超出螢幕
  const safeX = Math.min(Math.max(10, x), window.innerWidth - (isMobile ? 180 : 290))
  const safeY = Math.min(Math.max(10, y), window.innerHeight - 200)

  useEffect(() => {
    const video = videoRef.current
    if (!video) return

    // ✅ 設定音量
    if (shouldMute) {
      console.log('📱 行動裝置：彈出影片靜音')
      video.muted = true
      video.volume = 0
    } else {
      console.log('💻 桌面裝置：彈出影片有聲')
      video.muted = false
      video.volume = 0.3
    }

    // 嘗試播放
    const playPromise = video.play()
    if (playPromise !== undefined) {
      playPromise.catch((error) => {
        console.warn('彈出影片播放失敗，嘗試靜音播放:', error)
        // 播放失敗就強制靜音
        video.muted = true
        video.play().catch(() => console.warn('靜音後仍無法播放'))
      })
    }

    return () => {
      if (video) {
        video.pause()
        video.src = ''
      }
    }
  }, [shouldMute])

  useEffect(() => {
    if (!autoCloseOnEnd || !videoRef.current) return

    const video = videoRef.current
    const handleEnded = () => {
      onClose?.()
    }

    video.addEventListener('ended', handleEnded)
    return () => video.removeEventListener('ended', handleEnded)
  }, [autoCloseOnEnd, onClose])

  return (
    <motion.div
      initial={{ scale: 0, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      exit={{ scale: 0, opacity: 0 }}
      transition={{ type: 'spring', stiffness: 300, damping: 25 }}
      style={{
        position: 'fixed',
        left: safeX,
        top: safeY,
        zIndex: 1000,
        borderRadius: isMobile ? 8 : 12,
        overflow: 'hidden',
        border: '1px solid rgba(255, 255, 255, 0.1)',
        boxShadow: '0 0 40px rgba(245, 158, 11, 0.15), 0 20px 50px rgba(0,0,0,0.6)',
        background: '#1A1A24',
      }}
    >
      {/* 靜音提示（行動裝置才顯示） */}
      {shouldMute && (
        <div
          style={{
            position: 'absolute',
            bottom: 6,
            left: 6,
            padding: '4px 8px',
            background: 'rgba(0, 0, 0, 0.7)',
            borderRadius: 4,
            fontSize: 10,
            color: '#FAFAFA',
            zIndex: 5,
            display: 'flex',
            alignItems: 'center',
            gap: 4,
          }}
        >
          🔇
        </div>
      )}

      {showCloseButton && (
        <motion.button
          onClick={onClose}
          whileHover={{ scale: 1.1, background: '#F59E0B' }}
          whileTap={{ scale: 0.95 }}
          style={{
            position: 'absolute',
            top: 6,
            right: 6,
            width: isMobile ? 32 : 28,
            height: isMobile ? 32 : 28,
            background: 'rgba(26, 26, 36, 0.9)',
            backdropFilter: 'blur(8px)',
            color: '#FAFAFA',
            border: '1px solid rgba(255,255,255,0.15)',
            borderRadius: '50%',
            fontSize: isMobile ? 16 : 14,
            fontWeight: 600,
            cursor: 'pointer',
            zIndex: 10,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            transition: 'all 200ms ease-out',
            WebkitTapHighlightColor: 'transparent',
          }}
        >
          ✕
        </motion.button>
      )}
      <video
        ref={videoRef}
        src={src}
        loop={loop}
        playsInline
        muted={shouldMute} // ✅ 動態設定
        webkit-playsinline="true"
        style={{
          width: isMobile ? 160 : 280,
          height: 'auto',
          display: 'block',
        }}
      />
    </motion.div>
  )
}
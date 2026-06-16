import { motion } from "framer-motion";

export default function AIVoiceOrb({ state = "idle", size = 220 }) {
  const isListen = state === "listening";
  const isSpeak = state === "speaking";
  return (
    <div className="relative flex items-center justify-center" style={{ width: size, height: size }}>
      {/* outer halo rings */}
      <motion.div
        className="absolute rounded-full"
        style={{
          width: size, height: size,
          background: "radial-gradient(circle, rgba(233,196,106,0.25) 0%, rgba(224,122,95,0.05) 50%, transparent 70%)"
        }}
        animate={{ scale: isListen ? [1, 1.25, 1] : isSpeak ? [1, 1.12, 1] : [1, 1.05, 1] }}
        transition={{ duration: isListen ? 0.8 : isSpeak ? 1.4 : 2.6, repeat: Infinity, ease: "easeInOut" }}
      />
      {/* main orb */}
      <motion.div
        className="relative rounded-full"
        style={{
          width: size * 0.62, height: size * 0.62,
          background: "radial-gradient(circle at 30% 30%, #F1B58A 0%, #E07A5F 45%, #C25B3F 80%)",
          boxShadow: "inset 0 0 30px rgba(255,255,255,.25), 0 8px 40px rgba(224,122,95,.25)"
        }}
        animate={{
          scale: isListen ? [1, 1.06, 1] : isSpeak ? [1, 1.03, 1.05, 1] : [1, 1.02, 1],
        }}
        transition={{ duration: isListen ? 0.6 : isSpeak ? 0.5 : 2.2, repeat: Infinity, ease: "easeInOut" }}
      >
        {/* inner shimmer dot */}
        <motion.div
          className="absolute rounded-full"
          style={{
            width: 14, height: 14, top: "30%", left: "32%",
            background: "rgba(255,255,255,.7)", filter: "blur(2px)"
          }}
          animate={{ opacity: [0.4, 0.9, 0.4] }}
          transition={{ duration: 2, repeat: Infinity }}
        />
      </motion.div>
    </div>
  );
}

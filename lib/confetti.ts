import confetti from 'canvas-confetti';

/** Lance une salve de confettis festive. Non bloquant, ignore les erreurs. */
export function fireConfetti() {
  try {
    // Salve principale
    confetti({
      particleCount: 80,
      spread: 70,
      origin: { y: 0.6 },
      colors: ['#d35400', '#f39c12', '#e74c3c', '#2ecc71', '#3498db'],
    });
    // Seconde salve décalée pour un effet plus riche
    setTimeout(() => {
      confetti({
        particleCount: 50,
        spread: 90,
        origin: { y: 0.5, x: 0.35 },
        colors: ['#d35400', '#f39c12', '#e74c3c', '#2ecc71', '#3498db'],
      });
      confetti({
        particleCount: 50,
        spread: 90,
        origin: { y: 0.5, x: 0.65 },
        colors: ['#d35400', '#f39c12', '#e74c3c', '#2ecc71', '#3498db'],
      });
    }, 200);
  } catch {
    // Silencieux — confettis non critiques
  }
}

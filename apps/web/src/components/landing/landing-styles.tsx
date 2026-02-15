export function LandingStyles() {
  return (
    <style>{`
      @import url('https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wght@12..96,400;12..96,600;12..96,700;12..96,800&family=Nunito:wght@400;600;700&display=swap');

      .font-display {
        font-family: 'Bricolage Grotesque', sans-serif;
      }

      .font-body {
        font-family: 'Nunito', sans-serif;
      }

      @keyframes fadeInUp {
        from { opacity: 0; transform: translateY(20px); }
        to { opacity: 1; transform: translateY(0); }
      }

      @keyframes slideInRight {
        from { opacity: 0; transform: translateX(20px); }
        to { opacity: 1; transform: translateX(0); }
      }

      @keyframes float-envelope-1 {
        0%, 100% { transform: translateY(0) rotate(var(--rotate, 0deg)); }
        50% { transform: translateY(-20px) rotate(calc(var(--rotate, 0deg) + 5deg)); }
      }

      @keyframes float-envelope-2 {
        0%, 100% { transform: translateY(0) translateX(0) rotate(var(--rotate, 0deg)); }
        50% { transform: translateY(-15px) translateX(10px) rotate(calc(var(--rotate, 0deg) - 5deg)); }
      }

      @keyframes float-envelope-3 {
        0%, 100% { transform: translateY(0) translateX(0) rotate(var(--rotate, 0deg)); }
        33% { transform: translateY(-10px) translateX(-5px) rotate(calc(var(--rotate, 0deg) + 3deg)); }
        66% { transform: translateY(-20px) translateX(5px) rotate(calc(var(--rotate, 0deg) - 3deg)); }
      }

      @keyframes bounce-subtle {
        0%, 100% { transform: translateY(0); }
        50% { transform: translateY(-4px); }
      }

      @keyframes wave-underline {
        to { background-position: 100px 100%; }
      }

      .animate-fade-in-up {
        animation: fadeInUp 0.6s ease-out forwards;
      }

      .animate-slide-in-right {
        animation: slideInRight 0.5s ease-out forwards;
      }

      .animate-float-1 {
        animation: float-envelope-1 var(--duration, 6s) ease-in-out infinite;
      }

      .animate-float-2 {
        animation: float-envelope-2 var(--duration, 7s) ease-in-out infinite;
      }

      .animate-float-3 {
        animation: float-envelope-3 var(--duration, 8s) ease-in-out infinite;
      }

      .animate-bounce-subtle {
        animation: bounce-subtle 2s ease-in-out infinite;
      }

      .wavy-underline {
        position: relative;
        display: inline-block;
      }

      .wavy-underline::after {
        content: '';
        position: absolute;
        left: 0;
        right: 0;
        bottom: 0;
        height: 12px;
        background-image: url("data:image/svg+xml,%3Csvg width='100' height='12' viewBox='0 0 100 12' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M0 6 Q 12.5 0, 25 6 T 50 6 T 75 6 T 100 6' stroke='%23fbbf24' stroke-width='3' fill='none'/%3E%3C/svg%3E");
        background-size: 100px 12px;
        background-repeat: repeat-x;
        background-position: 0 100%;
        animation: wave-underline 2s linear infinite;
      }
    `}</style>
  );
}

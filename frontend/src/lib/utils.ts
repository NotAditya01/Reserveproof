export function spawnConfetti() {
  const colors = ['#7C6FCD', '#16A34A', '#FFD700', '#60A5FA', '#F472B6'];
  const particles: HTMLDivElement[] = [];
  for (let i = 0; i < 35; i += 1) {
    const node = document.createElement('div');
    const size = 5 + Math.random() * 3;
    node.className = 'confetti-particle';
    node.style.width = `${size}px`;
    node.style.height = `${size}px`;
    node.style.borderRadius = Math.random() > 0.5 ? '50%' : '1px';
    node.style.left = `${Math.random() * 100}vw`;
    node.style.top = '-10px';
    node.style.backgroundColor = colors[Math.floor(Math.random() * colors.length)];
    node.style.setProperty('--drift', `${-50 + Math.random() * 100}px`);
    node.style.setProperty('--rot', `${Math.random() * 360}deg`);
    node.style.animationDuration = `${1800 + Math.random() * 1000}ms`;
    node.style.animationDelay = `${Math.random() * 600}ms`;
    document.body.appendChild(node);
    particles.push(node);
  }
  window.setTimeout(() => particles.forEach((node) => node.remove()), 3500);
}

export function shortAddress(address: string): string {
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

export function timeAgo(value: string | number): string {
  const timestamp = typeof value === 'number' ? value : new Date(value).getTime();
  const diff = Date.now() - timestamp;
  const mins = Math.max(1, Math.floor(diff / (1000 * 60)));
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

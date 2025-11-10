import { Directive, ElementRef, Input, OnDestroy, OnInit } from '@angular/core';

@Directive({
  selector: '[appCountUp]',
  standalone: true,
})
export class CountUpDirective implements OnInit, OnDestroy {
  @Input() duration = 1200;
  @Input() startAt = 0;
  @Input() decimals = 0;
  @Input() countTo?: number;
  @Input() suffix?: string;
  @Input() prefix?: string;

  private io?: IntersectionObserver;
  private originalText = '';

  constructor(private el: ElementRef<HTMLElement>) {}

  ngOnInit(): void {
    const node = this.el.nativeElement;
    this.originalText = node.innerText.trim();

    if (this.countTo == null) {
      const { value, suffix } = this.parseNumber(this.originalText);
      this.countTo = value;
      if (!this.suffix) this.suffix = suffix;
    }

    // 👇 Observa el elemento continuamente
    this.io = new IntersectionObserver((entries) => {
      entries.forEach((e) => {
        if (e.isIntersecting) {
          // reinicia animación cada vez que entra visible
          this.animate();
        }
      });
    }, { threshold: 0.5 });

    this.io.observe(node);
  }

  ngOnDestroy(): void {
    this.io?.disconnect();
  }

  private animate() {
    const el = this.el.nativeElement;
    const end = this.countTo ?? 0;
    const start = this.startAt;
    const decimals = Math.max(0, this.decimals | 0);

    const startTime = performance.now();
    const dur = Math.max(200, this.duration);
    const easeOutCubic = (t: number) => 1 - Math.pow(1 - t, 3);

    const step = (now: number) => {
      const p = Math.min(1, (now - startTime) / dur);
      const eased = easeOutCubic(p);
      const current = start + (end - start) * eased;
      el.innerText = `${this.prefix ?? ''}${current.toFixed(decimals)}${this.suffix ?? ''}`;
      if (p < 1) requestAnimationFrame(step);
      else el.innerText = `${this.prefix ?? ''}${end.toFixed(decimals)}${this.suffix ?? ''}`;
    };

    requestAnimationFrame(step);
  }

  private parseNumber(text: string): { value: number; suffix: string } {
    const trimmed = text.replace(/\s+/g, '');
    const match = trimmed.match(/^([^\d\-+]*)(-?\d+(?:[.,]\d+)?)(.*)$/);
    if (!match) return { value: 0, suffix: '' };

    const [, prefix, num, tail] = match;
    if (!this.prefix && prefix) this.prefix = prefix;
    const normalized = num.replace(',', '.');
    const value = Number.parseFloat(normalized);
    const suffix = tail ?? '';
    return { value: isNaN(value) ? 0 : value, suffix };
  }
}

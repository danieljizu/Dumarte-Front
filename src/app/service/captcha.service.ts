import { Injectable, inject, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../environments/environment';

declare const grecaptcha: {
  enterprise: {
    ready: (callback: () => void) => void;
    execute: (siteKey: string, options: { action: string }) => Promise<string>;
  };
};

@Injectable({ providedIn: 'root' })
export class CaptchaService {
  private http = inject(HttpClient);
  private platformId = inject(PLATFORM_ID);

  private waitForGrecaptcha(timeoutMs = 20000): Promise<void> {
    if (!isPlatformBrowser(this.platformId)) {
      return Promise.reject('No es navegador');
    }

    const start = Date.now();
    return new Promise((resolve, reject) => {
      const tick = () => {
        if (
          typeof grecaptcha !== 'undefined' && 
          grecaptcha.enterprise &&
          typeof grecaptcha.enterprise.ready === 'function' &&
          typeof grecaptcha.enterprise.execute === 'function'
        ) {
          resolve();
          return;
        }
        
        if (Date.now() - start > timeoutMs) {
          reject(new Error('Timeout esperando reCAPTCHA Enterprise'));
          return;
        }
        
        setTimeout(tick, 100);
      };
      tick();
    });
  }

  async execute(action = 'contact'): Promise<string> {
    try {
      await this.waitForGrecaptcha();
      
      return new Promise((resolve, reject) => {
        grecaptcha.enterprise.ready(async () => {
          try {
            const token = await grecaptcha.enterprise.execute(
              environment.recaptchaSiteKey, 
              { action }
            );
            
            if (!token || typeof token !== 'string') {
              reject(new Error('Token inválido recibido'));
              return;
            }
            
            resolve(token);
          } catch (error) {
            reject(error);
          }
        });
      });
      
    } catch (error) {
      throw error;
    }
  }

  verifyToken(token: string) {
    return this.http.post<{ ok: boolean; score?: number }>(
      `${environment.apiUrl}/api/verify-captcha`,
      { token }
    );
  }
}
import { Component, OnInit, AfterViewInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Observable } from 'rxjs';

import { ProyectosService } from '../../service/services'; 
import { CountUpDirective } from '../../shared/count-up.directive';
import { CaptchaService } from '../../service/captcha.service';
import { EmailService } from '../../service/email.service';
import { environment } from '../../../environments/environment';

import Swal from 'sweetalert2';
(window as any).Swal = Swal;

interface Proyecto {
  id: number;
  titulo: string;
  descripcion: string;
  categoria: string;
  tags: string[];
  imagenes: string[];
}

@Component({
  selector: 'app-home',
  standalone: true,
  imports: [CommonModule, CountUpDirective],
  templateUrl: './home.html',
  styleUrls: ['./home.css'],
})
export class Home implements OnInit, AfterViewInit {
  private captcha = inject(CaptchaService);
  private proyectosService = inject(ProyectosService);
  private emailService = inject(EmailService);
  
  trackById = (_: number, p: Proyecto) => p.id;

  proyectos$!: Observable<Proyecto[]>;
  proyectos: Proyecto[] = [];

  categoriaSeleccionada: 'todos' | 'closets' | 'cocinas' | 'muebles' | 'remodelacion' | string = 'todos';

  proyectoSeleccionado: Proyecto | null = null;
  imagenActual = 0;

  // Estado del formulario de cotización
  enviandoCotizacion = false;

  ngOnInit(): void {
    this.proyectos$ = this.proyectosService.getProyectos();
    this.proyectos$.subscribe(lista => this.proyectos = lista);
  }

  ngAfterViewInit(): void {
  }

  // ==== FILTRO ANGULAR ====
  setFiltro(cat: string) {
    this.categoriaSeleccionada = cat;
  }

  get filteredProyectos(): Proyecto[] {
    if (this.categoriaSeleccionada === 'todos') return this.proyectos;
    return this.proyectos.filter(p => p.categoria === this.categoriaSeleccionada);
  }

  // ==== Modal / galería ====
  abrirModal(id: number): void {
    this.proyectoSeleccionado = this.proyectos.find(p => p.id === id) ?? null;
    this.imagenActual = 0;

    if (this.proyectoSeleccionado) {
      const modalElement = document.getElementById('modalProyecto');
      if (modalElement) {
        const modal = new (window as any).bootstrap.Modal(modalElement);
        modal.show();
      }
    }
  }

  cerrarModalYCotizar(): void {
    const modalElement = document.getElementById('modalProyecto');
    if (modalElement) {
      const modal = (window as any).bootstrap.Modal.getInstance(modalElement);
      if (modal) {
        modal.hide();
      }
    }

    setTimeout(() => {
      const target = document.querySelector('#contacto');
      if (target) {
        target.scrollIntoView({
          behavior: 'smooth',
          block: 'start'
        });
      }
    }, 300); 
  }

  get imagenActualUrl(): string {
    return this.proyectoSeleccionado?.imagenes?.[this.imagenActual] ?? '';
  }
  get esUltimaImagen(): boolean {
    const len = this.proyectoSeleccionado?.imagenes?.length ?? 0;
    return this.imagenActual === Math.max(0, len - 1);
  }
  get esPrimeraImagen(): boolean { return this.imagenActual === 0; }
  get tieneMultiplesImagenes(): boolean { return (this.proyectoSeleccionado?.imagenes?.length ?? 0) > 1; }

  imagenAnterior(): void { if (this.imagenActual > 0) this.imagenActual--; }
  imagenSiguiente(): void {
    if (this.proyectoSeleccionado && this.imagenActual < this.proyectoSeleccionado.imagenes.length - 1) {
      this.imagenActual++;
    }
  }
  irAImagen(i: number): void { this.imagenActual = i; }

  // ==== ENVÍO DE COTIZACIÓN CON INTEGRACIÓN DE EMAIL ====
  async onEnviarCotizacion(event: Event) {
    event.preventDefault();
    
    const form = event.target as HTMLFormElement;
    const btnSubmit = form.querySelector('.btn-submit-cotizacion') as HTMLButtonElement;
    
    // Extraer valores del formulario
    const nombre = (form.querySelector('#nombre') as HTMLInputElement).value.trim();
    const email = (form.querySelector('#email') as HTMLInputElement).value.trim();
    const telefono = (form.querySelector('#telefono') as HTMLInputElement).value.trim();
    const ciudad = (form.querySelector('#ciudad') as HTMLInputElement).value.trim();
    const servicio = (form.querySelector('#servicio') as HTMLSelectElement).value.trim();
    const mensaje = (form.querySelector('#mensaje') as HTMLTextAreaElement).value.trim();

    // Presupuesto (opcional)
    const presupuestoRadio = form.querySelector('input[name="presupuesto"]:checked') as HTMLInputElement;
    const presupuesto = presupuestoRadio ? presupuestoRadio.value : '';

    // Validación de campos obligatorios
    if (!nombre || !email || !telefono || !mensaje || !servicio) {
      this.mostrarAlerta('Por favor completa todos los campos obligatorios marcados con *', 'error');
      return;
    }

    // Validación básica de email
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      this.mostrarAlerta('Por favor ingresa un correo electrónico válido', 'error');
      return;
    }

    // Validación de teléfono (mínimo 7 dígitos)
    const telefonoLimpio = telefono.replace(/\D/g, '');
    if (telefonoLimpio.length < 7) {
      this.mostrarAlerta('Por favor ingresa un número de teléfono válido', 'error');
      return;
    }

    // Estado de envío
    this.enviandoCotizacion = true;
    this.actualizarBotonEnvio(btnSubmit, true);

    try {
      // 1. Validar reCAPTCHA
      const token = await this.captcha.execute('contact');
      const captchaResult = await this.captcha.verifyToken(token).toPromise();

      if (!captchaResult?.ok) {
        throw new Error('Error al verificar el captcha. Por favor intenta nuevamente.');
      }

      // 2. Preparar mensaje completo con presupuesto si existe
      let mensajeCompleto = mensaje;
      if (presupuesto) {
        const presupuestoTexto = this.obtenerTextoPresupuesto(presupuesto);
        mensajeCompleto += `\n\nPresupuesto aproximado: ${presupuestoTexto}`;
      }

      // 3. Enviar cotización por email
      const emailRequest = {
        to: environment.emailDestinatario, // Email configurado en environment (debe estar en whitelist)
        name: nombre,
        email: email,
        telefono: telefono,
        ciudad: ciudad,
        servicio: this.obtenerTextoServicio(servicio),
        mensaje: mensajeCompleto
      };

      await this.emailService.enviarCotizacion(emailRequest).toPromise();

      // 4. Éxito - Mostrar mensaje y limpiar formulario
      this.mostrarAlerta(
        '¡Cotización enviada exitosamente! 🎉\n\nNos pondremos en contacto contigo en menos de 24 horas.',
        'success'
      );
      
      form.reset();

      // Scroll suave a la parte superior del formulario
      setTimeout(() => {
        const formulario = document.querySelector('.formulario-cotizacion');
        if (formulario) {
          formulario.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
      }, 500);

    } catch (err: any) {
      console.error('Error al enviar cotización:', err);
      
      let mensajeError = 'Ocurrió un error al enviar tu cotización. ';
      
      // Mensajes de error más específicos según el tipo
      if (err.message.includes('captcha')) {
        mensajeError += 'Hubo un problema con la verificación de seguridad.';
      } else if (err.message.includes('destinatario')) {
        mensajeError += 'Servicio temporalmente no disponible.';
      } else if (err.message.includes('conectar')) {
        mensajeError += 'Verifica tu conexión a internet.';
      } else {
        mensajeError += err.message || 'Por favor intenta nuevamente.';
      }
      
      mensajeError += '\n\nPuedes contactarnos directamente por WhatsApp o teléfono.';
      
      this.mostrarAlerta(mensajeError, 'error');
      
    } finally {
      this.enviandoCotizacion = false;
      this.actualizarBotonEnvio(btnSubmit, false);
    }
  }

  /**
   * Actualiza el estado visual del botón de envío
   */
  private actualizarBotonEnvio(btn: HTMLButtonElement, enviando: boolean): void {
    if (!btn) return;

    if (enviando) {
      btn.disabled = true;
      btn.innerHTML = `
        <span class="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></span>
        Enviando cotización...
      `;
      btn.style.opacity = '0.7';
      btn.style.cursor = 'not-allowed';
    } else {
      btn.disabled = false;
      btn.innerHTML = `
        <i class="fas fa-paper-plane"></i> Solicitar Cotización
      `;
      btn.style.opacity = '1';
      btn.style.cursor = 'pointer';
    }
  }

  /**
   * Muestra alertas usando SweetAlert2 o alert nativo
   */
  private mostrarAlerta(mensaje: string, tipo: 'success' | 'error'): void {
    // Si tienes SweetAlert2 instalado, úsalo
    if (typeof (window as any).Swal !== 'undefined') {
      const Swal = (window as any).Swal;
      Swal.fire({
        icon: tipo,
        title: tipo === 'success' ? '¡Éxito!' : 'Oops...',
        text: mensaje,
        confirmButtonColor: '#F7931E',
        confirmButtonText: 'Entendido',
        customClass: {
          popup: 'swal-custom'
        }
      });
    } else {
      // Fallback a alert nativo con mejor formato
      const icono = tipo === 'success' ? '✓' : '✗';
      alert(`${icono} ${mensaje}`);
    }
  }

  /**
   * Convierte el código del servicio a texto legible
   */
  private obtenerTextoServicio(codigo: string): string {
    const servicios: { [key: string]: string } = {
      'closets': 'Closets a Medida',
      'cocinas': 'Cocinas Integrales',
      'muebles': 'Muebles a Medida',
      'carpinteria': 'Carpintería General',
      'diseno': 'Diseño Personalizado',
      'otro': 'Otro'
    };
    return servicios[codigo] || codigo;
  }

  /**
   * Convierte el código del presupuesto a texto legible
   */
  private obtenerTextoPresupuesto(codigo: string): string {
    const presupuestos: { [key: string]: string } = {
      'menos-1m': 'Menos de $1.000.000',
      '1m-3m': '$1.000.000 - $3.000.000',
      '3m-5m': '$3.000.000 - $5.000.000',
      'mas-5m': 'Más de $5.000.000'
    };
    return presupuestos[codigo] || 'No especificado';
  }
}
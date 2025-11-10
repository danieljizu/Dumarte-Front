import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Observable, throwError } from 'rxjs';
import { catchError, map } from 'rxjs/operators';
import { environment } from '../../environments/environment';

export interface EmailRequest {
  to: string;           // Email del destinatario (debe estar en whitelist del backend)
  name: string;         // Nombre del remitente
  email: string;        // Email del remitente
  telefono: string;     // Teléfono
  ciudad: string;       // Ciudad
  servicio: string;     // Servicio solicitado
  mensaje: string;      // Mensaje/contenido (puede incluir presupuesto)
}

export interface EmailResponse {
  ok: boolean;
  message?: string;
  error?: string;
  detail?: string;
}

@Injectable({ providedIn: 'root' })
export class EmailService {
  private http = inject(HttpClient);
  
  // URL del endpoint de tu backend WAR
  private readonly API_URL = `${environment.apiUrl}/api/send-email`;

  /**
   * Envía un email de cotización al backend
   * @param request Datos del formulario de cotización
   * @returns Observable con la respuesta del servidor
   */
  enviarCotizacion(request: EmailRequest): Observable<EmailResponse> {
    return this.http.post<EmailResponse>(this.API_URL, request).pipe(
      map(response => {
        if (!response.ok) {
          throw new Error(response.detail || response.error || 'Error desconocido');
        }
        return response;
      }),
      catchError(this.handleError)
    );
  }

  /**
   * Manejo centralizado de errores HTTP
   */
  private handleError(error: HttpErrorResponse): Observable<never> {
    let errorMessage = 'Ocurrió un error al enviar el correo';

    if (error.error instanceof ErrorEvent) {
      // Error del lado del cliente o de red
      errorMessage = `Error: ${error.error.message}`;
    } else {
      // Error del backend
      const serverError = error.error as EmailResponse;
      
      switch (error.status) {
        case 400:
          errorMessage = 'Faltan campos obligatorios en el formulario';
          break;
        case 403:
          errorMessage = 'El destinatario no está autorizado';
          break;
        case 502:
          errorMessage = 'Error al conectar con el servidor de correo';
          break;
        case 500:
          errorMessage = serverError?.detail || 'Error interno del servidor';
          break;
        case 0:
          errorMessage = 'No se pudo conectar con el servidor. Verifica tu conexión.';
          break;
        default:
          errorMessage = serverError?.detail || `Error ${error.status}: ${error.statusText}`;
      }
    }

    console.error('Error en EmailService:', errorMessage, error);
    return throwError(() => new Error(errorMessage));
  }
}
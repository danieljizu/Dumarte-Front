import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { shareReplay, map } from 'rxjs/operators';
import { Observable } from 'rxjs';

interface Proyecto {
  id: number;
  titulo: string;
  descripcion: string;
  categoria: string;
  tags: string[];
  imagenes: string[];
}

@Injectable({ providedIn: 'root' })
export class ProyectosService {
  private http = inject(HttpClient);
  private cache$?: Observable<Proyecto[]>;

  getProyectos(): Observable<Proyecto[]> {
    if (!this.cache$) {
      this.cache$ = this.http
        .get<Proyecto[]>('assets/data/proyectos.json')
        .pipe(shareReplay(1));
    }
    return this.cache$;
  }

  getProyectoById(id: number): Observable<Proyecto | undefined> {
    return this.getProyectos().pipe(map(list => list.find(p => p.id === id)));
  }

  refresh(): void {
    this.cache$ = undefined;
  }
}

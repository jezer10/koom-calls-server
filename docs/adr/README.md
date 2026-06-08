# Architecture Decision Records (ADRs)

Este directorio contiene las decisiones arquitectónicas del backend de
Koom (NestJS). Cada ADR captura el **contexto**, la **decisión**, las
**consecuencias** y las **alternativas consideradas** de un cambio
estructural.

## Índice

| Nº     | Título                                                          | Estado     | Fecha       |
| ------ | --------------------------------------------------------------- | ---------- | ----------- |
| 0001   | [Arquitectura WebRTC multiusuario: control plane + SFU](0001-webrtc-multiusuario-control-plane.md) | Aceptado   | 2026-06-08  |

## Convención

- Nombre de archivo: `NNNN-titulo-en-kebab-case.md`, índice correlativo.
- Encabezado obligatorio: `Estado`, `Fecha`, `Ticket`, `Autores`,
  opcionalmente `Relacionado`.
- Secciones obligatorias: `Contexto`, `Decisión`, `Consecuencias`,
  `Alternativas consideradas`.
- Cambios sobre un ADR ya aceptado se hacen en un ADR nuevo que lo
  **referencie y reemplace** (no se edita el histórico salvo para
  corregir erratas).

# AGENTS.md

## Regla de despliegue Hostinger

- Despues de cambios de codigo o datos visibles, desplegar siempre a Hostinger antes de cerrar la tarea.
- No entregar como final una version solo local ni pedir al usuario que pruebe localmente cuando exista despliegue Hostinger disponible.
- Si el despliegue falla por credenciales, conectividad o herramienta, explicar el bloqueo concreto y que falta para completar la publicacion.
- No ejecutar acciones de Git como commit, push, cambios de rama, merges, resets, tags o pull requests salvo que el usuario pida exactamente esa accion.

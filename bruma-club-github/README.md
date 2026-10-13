# BRUMA CLUB · Versión corregida (13/10/2026)

## Abrir sin bloqueo en la portada

**Abre `index.html`**: es la versión autónoma, con los estilos, el código JavaScript y todas las fotografías optimizadas incrustados. Puedes abrirla con doble clic, incluso fuera de esta carpeta y sin servidor ni Internet (las fuentes externas tienen alternativas locales).

La portada con el monograma se cierra automáticamente por CSS incluso si JavaScript está bloqueado. El sitio ya no fija el scroll con `body.gated`. Como respaldo, la sección Drop 001 incluye fotos estáticas que serán sustituidas por las tarjetas interactivas una vez que arranque JavaScript.

## Editar el proyecto

- `index-src.html`: HTML fuente editable.
- `styles.css`: hoja de estilos fuente.
- `script.js`: JavaScript fuente.
- `assets/`: todas las fotos, logos y fotos originales.
- `index.html`: versión final autónoma generada con los archivos fuente. Edita los anteriores si deseas hacer cambios; reconstruye el HTML autónomo con el generador.

**Importante:** `index.html` incluye copia incrustada del JS y CSS; cambiar `script.js` o `styles.css` no modifica automáticamente el autónomo. Para trabajo de desarrollo, usa `index-src.html` con servidor local o ejecuta `generar_web.py` para reconstruir `index.html`.

En un servidor local opcional: `python -m http.server 8000`, luego visita `http://localhost:8000/index-src.html`.

## Comercio

Se mantiene **únicamente una simulación** de compra, reservas, formularios e inventario. No se procesa ningún pago real. Para publicar un comercio funcional debes integrar servicios de pago, inventario, correo, políticas de privacidad y teléfono de contacto.

---

# BRUMA CLUB · Web estática (Drop 001)

Proyecto completo organizado para desplegar en cualquier hosting estático (GitHub Pages, Netlify, Vercel, Cloudflare Pages) o abrir con un servidor local.

## Carpetas

```
bruma-club/
├── index.html
├── styles.css
├── script.js
├── README.md
└── assets/
    ├── crewneck-birch.webp
    ├── crewneck-camel.webp
    ├── crewneck-navy.webp
    ├── crewneck-carbon.webp
    ├── editorial-*.webp / detail-*.webp  # Recortes de las fotos originales
    ├── logo-bc-crema.png
    ├── logo-bc-carbon.png
    ├── og-image.jpg
    └── originales/                     # 4 PNG originales, sin reducción
```

## Ejecutar

Desde la carpeta del proyecto, ejecutar:

```bash
python -m http.server 8000
```

Visitar http://localhost:8000. Para publicar, subir la carpeta **completa**, manteniendo `assets/` al lado de `index.html`.

## Fotografías incluidas

- Birch Cream: imagen `0414379B-…png` → `assets/crewneck-birch.webp`.
- Camel: `5A018A60-…png` → `assets/crewneck-camel.webp`.
- Navy: `E46F760D-…png` → `assets/crewneck-navy.webp`.
- Carbon: `CFDAB6E1-…png` → `assets/crewneck-carbon.webp`.
- Ambos logotipos suministrados se encuentran en `assets/`. Los originales completos están en `assets/originales/`.
- La portada social `og-image.jpg` fue elaborada con el logotipo original.

Se reemplazaron los marcadores sin fotografía real (logos de prensa, fundador, macros de caja/etiquetas y unboxing) por imágenes editoriales reales o por el monograma. El **unboxing animado** se sustituyó por un lookbook fotográfico porque no se proporcionaron imágenes de caja, pasaporte, tissue o etiqueta. El proyecto no pretende mostrar elementos de embalaje inexistentes.

## Configuración necesaria antes de vender

El diseño **NO** procesa pagos, envía emails, registra reservas, sincroniza inventario ni emite boletas/facturas: mantiene el simulador del HTML/JS original con advertencias explícitas de vista previa. El inventario del objeto CONFIG solo vive en el navegador y se reinicia al recargar. Para un e-commerce real hace falta backend de pedidos, control transaccional de stock, webhooks y proveedor de pagos, además de políticas legales validadas.

Abrir `script.js` y editar `CONFIG`: 

- `DROP_DATE`: está configurado para el 18 de mayo de 2027 a las 19:00 hora de Lima.
- `MODE`: `auto`, `presale` o `launch` para controlar la experiencia.
- `PRICE`, `PRICE_USD`, `CURRENCY`, `COLORS.remaining`: cantidades de ejemplo, **no** inventario operativo.
- `FORM_ENDPOINT`: vacío; es una vista previa y no recopila leads hasta que se conecte un servicio.
- `WHATSAPP`: `51999999999` es un **número de ejemplo** que debe reemplazarse.
- `PAYMENT.provider`: `simulate` es vista previa. Escribir el nombre de otro proveedor **no** lo integra: falta el backend.
- `GA4_ID` y `META_PIXEL_ID`: opt-in al seguimiento al configurar. Revisar consentimiento y privacidad.
- Instagram, textos sobre proveedores, envíos, material, fabricación, dimensiones, precios y disponibilidad: confirmar antes de publicarlos como hechos.
- `LEGAL_PAGES` en `script.js`: políticas de ejemplo, requieren revisión jurídica.

Nota: las fotografías y los logos se sirven localmente. Las familias tipográficas Google Fonts aún dependen de Internet; CSS tiene tipografías alternativas para cuando se use sin conexión.

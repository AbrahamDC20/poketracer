/* ==========================================================================
   MÓDULO: MEDIA MANAGER
   ========================================================================== */
export const mediaManager = {
    // Carga la imagen de la carta basándose en su ID
    loadImage(card) {
        if (!card || !card.id_carta) return 'assets/images/card-back.webp';
        
        // Formato esperado: SET-NUMERO (ej: A1-001)
        const parts = card.id_carta.split('-');
        if (parts.length === 2) {
            return `assets/images/cards/${parts[0]}-${parseInt(parts[1], 10)}.webp`;
        }
        return 'assets/images/card-back.webp';
    },

    // Imagen por defecto si falla la carga
    fallbackImage(e) {
        e.target.src = 'assets/images/card-back.webp';
    },

    // Logo de la expansión
    loadSetLogo(exp) {
        if (!exp || exp === 'TODAS') return null;
        return `assets/images/sets/${exp.split(' ')[0]}.webp`;
    },

    // Icono de tipo de energía
    loadEnergyIcon(type, map) {
        if (!type) return '';
        const cleanType = type.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();
        const finalName = (map && map[cleanType]) ? map[cleanType] : cleanType;
        const fileName = finalName.charAt(0).toUpperCase() + finalName.slice(1).toLowerCase();
        return `assets/images/types/${fileName}.webp`;
    },

    // Efecto 3D
    handle3DMyCard(e, isLowPower) {
        if (isLowPower) return; 
        const rect = e.currentTarget.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        const rotateX = ((y - rect.height / 2) / 20) * -1;
        const rotateY = (x - rect.width / 2) / 20;
        const target = e.currentTarget.querySelector('.card-aura-box') || e.currentTarget;
        target.style.transform = `perspective(1000px) rotateX(${rotateX}deg) rotateY(${rotateY}deg) scale(1.05)`;
    },

    reset3DCard(e) {
        const target = e.currentTarget.querySelector('.card-aura-box') || e.currentTarget;
        target.style.transform = 'perspective(1000px) rotateX(0) rotateY(0) scale(1)';
    }
};
import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { ArrowLeft, CheckCircle2, ChevronRight, ShoppingBag, ShieldCheck } from 'lucide-react';
import { motion } from 'framer-motion';
import { useTenant } from '../../context/TenantContext';
import { useCartStore } from '../../store/cartStore';
import { supabase } from '../../lib/supabaseClient';
import type { Product } from '../../types';
import { toast } from '../../store/toastStore';
import { UI_COLORS } from '../../lib/constants.ts';
import { logger } from '../../lib/logger';

export default function ProductDetailPage() {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const { tenant } = useTenant();
  const [product, setProduct] = useState<Product | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedImage, setSelectedImage] = useState<string>('');
  
  const addItem = useCartStore((s) => s.addItem);
  const openCart = useCartStore((s) => s.openCart);

  const [selectedVariantId, setSelectedVariantId] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    async function fetchProduct() {
      if (!slug || !tenant.id) return;
      setLoading(true);
      try {
        // Buscamos primero por slug, si no por ID
        let query = supabase
          .from('productos')
          .select(`
            id,
            tienda_id,
            nombre,
            descripcion,
            precio,
            imagen_url,
            disponible,
            producto_variantes (
              id,
              producto_id,
              nombre,
              precio,
              stock,
              sku,
              imagen_url
            )
          `)
          .eq('tienda_id', tenant.id);

        // Si el slug parece un UUID, buscamos por ID, si no por slug
        const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(slug);
        if (isUuid) {
          query = query.eq('id', slug);
        } else {
          query = query.eq('slug', slug);
        }

        const { data, error } = await query.maybeSingle();

        if (error) throw error;
        if (active && data) {
          const images = [];
          if (data.imagen_url) images.push(data.imagen_url);
          
          const variants = (data.producto_variantes || []).map((v: any) => ({
            id: v.id,
            productId: v.producto_id,
            name: v.nombre,
            price: v.precio !== null && v.precio !== undefined ? Number(v.precio) : null,
            stock: v.stock ?? 0,
            sku: v.sku || '',
            image: v.imagen_url || undefined
          }));

          const mappedProduct: Product = {
            id: data.id,
            tienda_id: data.tienda_id,
            name: data.nombre,
            description: data.descripcion || '',
            basePrice: Number(data.precio) || 0,
            images,
            variants,
            isAvailable: data.disponible ?? true
          };

          setProduct(mappedProduct);
          setSelectedImage(images[0] || '');
          
          // Seleccionar primera variante por defecto si existe
          if (variants.length > 0) {
            setSelectedVariantId(variants[0].id);
          }
        }
      } catch (err) {
        logger.error('Error fetching product:', err as Error);
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    }
    fetchProduct();
    return () => {
      active = false;
    };
  }, [slug, tenant.id]);

  const selectedVariant = product?.variants.find(v => v.id === selectedVariantId);
  const finalPrice = product ? (selectedVariant?.price ?? product.basePrice) : 0;

  // Cambiar la foto automáticamente si la variante tiene una
  useEffect(() => {
    if (selectedVariant?.image) {
      setSelectedImage(selectedVariant.image);
    } else if (product?.images[0]) {
      // Opcional: volver a la imagen principal si la variante no tiene foto
      setSelectedImage(product.images[0]);
    }
  }, [selectedVariantId, selectedVariant?.image, product?.images]);

  if (loading) {
    return (
      <div className="min-h-screen bg-crema pt-24 px-6 flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-verde border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  if (!product) {
    return (
      <div className="min-h-screen bg-crema pt-24 px-6 flex flex-col items-center justify-center text-center">
        <h1 className="text-2xl font-bold text-texto mb-2">Producto no encontrado</h1>
        <p className="text-texto-muted mb-6">El producto que buscas no existe o fue retirado.</p>
        <button onClick={() => navigate('/')} className="bg-verde text-[var(--color-background-primary)] px-6 py-2 rounded-full font-medium">
          Volver al inicio
        </button>
      </div>
    );
  }

  const handlePedir = () => {
    if (!product) return;
    
    addItem({
      productId: product.id,
      variantId: selectedVariantId || product.id,
      name: product.name,
      variantName: selectedVariant ? selectedVariant.name : 'Estándar',
      unitPrice: finalPrice,
      quantity: 1,
      image: product.images[0],
    });
    toast.success('Agregado al carrito', { duration: 3000 });
    openCart();
  };

  const isWhatsAppConfigured = tenant.whatsapp && tenant.whatsapp !== '0000000000' && /^\d{10,15}$/.test(tenant.whatsapp.replace(/\D/g, ''));

  const handleWhatsApp = () => {
    if (!isWhatsAppConfigured || !product) {
      return toast.error('Esta tienda aún no ha configurado su WhatsApp.');
    }
    const cleanNumber = tenant.whatsapp.replace(/\D/g, '');
    const variantText = selectedVariant ? ` (${selectedVariant.name})` : '';
    const text = encodeURIComponent(`Hola, me interesa el arreglo "${product.name}"${variantText} con un precio de $${finalPrice} ${tenant.currency}. ¿Tienen disponibilidad?`);
    window.open(`https://wa.me/${cleanNumber}?text=${text}`, '_blank', 'noopener');
  };

  return (
    <div className="min-h-[100svh] bg-crema pb-24 lg:pb-0">
      <Helmet>
        <title>{`${product.name} | ${tenant.nombre}`}</title>
        <meta name="description" content={product.description} />
        <meta property="og:title" content={product.name} />
        <meta property="og:description" content={product.description} />
        <meta property="og:image" content={product.images[0]} />
        <meta property="og:type" content="product" />
      </Helmet>
      
      <div className="max-w-[1200px] mx-auto px-4 sm:px-6 pt-24 pb-12">
        
        {/* Breadcrumb */}
        <nav className="flex items-center gap-2 text-sm text-texto-muted mb-8 overflow-x-auto whitespace-nowrap hide-scrollbar">
          <button onClick={() => navigate('/')} className="hover:text-verde transition-colors flex items-center gap-1">
            <ArrowLeft className="w-4 h-4" /> Inicio
          </button>
          <ChevronRight className="w-4 h-4 opacity-50" />
          <span className="text-texto truncate">{product.name}</span>
        </nav>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-10 lg:gap-16">
          {/* Galería de imágenes */}
          <div className="space-y-4">
            <div className="aspect-[4/3] rounded-2xl overflow-hidden bg-crema-dark relative">
              <img 
                src={selectedImage} 
                alt={product.name} 
                className="w-full h-full object-cover"
                loading="eager"
                fetchpriority="high"
              />
              {!product.isAvailable && (
                <div className="absolute inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center">
                  <span className="bg-[var(--color-background-primary)] text-texto px-4 py-2 rounded-lg font-bold text-sm tracking-wider uppercase">
                    Agotado
                  </span>
                </div>
              )}
            </div>
            
            {product.images.length > 1 && (
              <div className="flex gap-3 overflow-x-auto hide-scrollbar pb-2">
                {product.images.map((img, idx) => (
                  <button
                    key={idx}
                    onClick={() => setSelectedImage(img)}
                    className={`shrink-0 w-20 h-20 rounded-xl overflow-hidden border-2 transition-all ${
                      selectedImage === img ? 'border-verde' : 'border-transparent opacity-70 hover:opacity-100'
                    }`}
                  >
                    <img src={img} alt={`${product.name} - Vista ${idx + 1}`} className="w-full h-full object-cover" loading="lazy" />
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Detalles del producto */}
          <div className="flex flex-col">
            <div className="mb-6">
              <h1 className="font-display text-3xl sm:text-4xl lg:text-5xl font-bold text-texto leading-[1.1] mb-3">
                {product.name}
              </h1>
              <div className="flex items-baseline gap-2">
                <p className="font-display text-3xl text-verde font-bold">
                  ${finalPrice.toLocaleString('en-US')}
                </p>
                <span className="text-sm font-medium text-texto-muted uppercase tracking-wider">{tenant.currency}</span>
              </div>
            </div>

            {/* Selector de Variantes */}
            {product.variants.length > 0 && (
              <div className="mb-8">
                <label className="block text-xs font-bold text-texto-muted uppercase tracking-widest mb-3">
                  Selecciona una opción:
                </label>
                <div className="flex flex-wrap gap-2">
                  {product.variants.map((v) => (
                    <button
                      key={v.id}
                      onClick={() => setSelectedVariantId(v.id)}
                      className={`px-4 py-2.5 rounded-xl border-2 text-sm font-semibold transition-all ${
                        selectedVariantId === v.id
                          ? 'border-verde bg-verde/5 text-verde shadow-sm'
                          : 'border-[var(--color-border-secondary)] text-texto-muted hover:border-verde/30'
                      }`}
                    >
                      {v.name}
                      <span className="ml-1.5 opacity-60 font-normal">
                        (${((v.price !== null && v.price !== undefined) ? v.price : product.basePrice).toLocaleString()} {tenant.currency})
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div className="prose prose-sm sm:prose-base prose-emerald text-texto-muted mb-8">
              <p>{product.description}</p>
            </div>

            {/* Beneficios estáticos (ejemplo) */}
            <ul className="space-y-3 mb-10 text-sm text-texto-muted">
              <li className="flex items-start gap-2">
                <CheckCircle2 className="w-5 h-5 text-verde shrink-0" />
                <span>Flores frescas seleccionadas el mismo día de la entrega.</span>
              </li>
              <li className="flex items-start gap-2">
                <ShieldCheck className="w-5 h-5 text-verde shrink-0" />
                <span>Garantía de calidad. Si llega dañado, lo reponemos.</span>
              </li>
            </ul>

            {/* Desktop CTA (Mobile CTA es sticky bottom) */}
            <div className="hidden lg:flex flex-col gap-3 mt-auto">
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={handlePedir}
                disabled={!product.isAvailable}
                className="w-full flex items-center justify-center gap-2 bg-rosa text-[var(--color-background-primary)] font-semibold py-4 px-6 rounded-xl text-lg hover:bg-[var(--hover-bg)] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                style={{ '--hover-bg': UI_COLORS.PRIMARY_HOVER } as React.CSSProperties}
              >
                <ShoppingBag className="w-5 h-5" />
                Agregar al Carrito
              </motion.button>
              <button
                onClick={handleWhatsApp}
                className="w-full flex items-center justify-center gap-2 bg-[var(--color-background-primary)] border-2 text-[var(--wa-color)] font-semibold py-3.5 px-6 rounded-xl hover:bg-[var(--wa-hover)] transition-colors"
                style={{ borderColor: UI_COLORS.WHATSAPP, '--wa-color': UI_COLORS.WHATSAPP, '--wa-hover': UI_COLORS.WHATSAPP + '0d' } as React.CSSProperties}
              >
                Consultar por WhatsApp
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Mobile Sticky Bottom CTA */}
      <div className="lg:hidden fixed bottom-0 left-0 right-0 p-4 bg-[var(--color-background-primary)]/90 backdrop-blur-md border-t border-[var(--color-border-tertiary)] z-40 shadow-[0_-10px_40px_rgba(0,0,0,0.08)]">
        <div className="flex gap-3 max-w-md mx-auto">
          <button
            onClick={handleWhatsApp}
            className="flex-1 flex items-center justify-center bg-[var(--color-background-primary)] border font-semibold py-3.5 rounded-xl active:bg-[var(--wa-active)] transition-colors"
            style={{ borderColor: UI_COLORS.WHATSAPP, color: UI_COLORS.WHATSAPP, '--wa-active': UI_COLORS.WHATSAPP + '1a' } as React.CSSProperties}
          >
            WhatsApp
          </button>
          <button
            onClick={handlePedir}
            disabled={!product.isAvailable}
            className="flex-[2] flex items-center justify-center gap-2 bg-rosa text-[var(--color-background-primary)] font-semibold py-3.5 rounded-xl active:bg-[var(--hover-bg)] transition-colors disabled:opacity-50"
            style={{ '--hover-bg': UI_COLORS.PRIMARY_HOVER } as React.CSSProperties}
          >
            Agregar — ${finalPrice}
          </button>
        </div>
      </div>
    </div>
  );
}

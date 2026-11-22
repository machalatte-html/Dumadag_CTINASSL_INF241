import React, { useEffect, useMemo, useState } from 'react';
import { createRoot } from 'react-dom/client';
import './styles.css';

const USD_PHP_RATE = 63.825;
const pesoPrice = (usd) => Math.round((usd * USD_PHP_RATE) / 50) * 50;
const demoProducts = [
  {
    _id: 'p1',
    name: 'GeForce RTX 4070 SUPER',
    brand: 'NVIDIA',
    category: { name: 'Graphics Cards' },
    description:
      'Powerful 1440p gaming, ray tracing, and creator performance in a refined dual-fan design.',
    price: pesoPrice(599),
    stock: 8,
    image:
      'https://images.unsplash.com/photo-1591488320449-011701bb6704?auto=format&fit=crop&w=900&q=85',
    featured: true,
    specs: { Memory: '12GB GDDR6X', Interface: 'PCIe 4.0' },
  },
  {
    _id: 'p2',
    name: 'Ryzen 7 7800X3D',
    brand: 'AMD',
    category: { name: 'Processors' },
    description: 'A high-performance gaming processor powered by 3D V-Cache technology.',
    price: pesoPrice(369),
    stock: 11,
    image:
      'https://images.unsplash.com/photo-1555617981-dac3880eac6e?auto=format&fit=crop&w=900&q=85',
    featured: true,
    specs: { Cores: '8', Socket: 'AM5' },
  },
  {
    _id: 'p3',
    name: 'Core i7-14700K',
    brand: 'Intel',
    category: { name: 'Processors' },
    description: 'Versatile desktop processor for gaming, creation, and demanding multitasking.',
    price: pesoPrice(389),
    stock: 6,
    image:
      'https://images.unsplash.com/photo-1555617981-dac3880eac6e?auto=format&fit=crop&w=900&q=85',
    specs: { Cores: '20', Socket: 'LGA 1700' },
  },
  {
    _id: 'p4',
    name: 'Vengeance 32GB DDR5',
    brand: 'Corsair',
    category: { name: 'Memory' },
    description:
      'Low-latency DDR5 memory kit built for reliable performance and easy installation.',
    price: pesoPrice(99),
    stock: 20,
    image:
      'https://images.unsplash.com/photo-1562976540-1502c2145186?auto=format&fit=crop&w=900&q=85',
    specs: { Capacity: '32GB', Speed: '6000MT/s' },
  },
  {
    _id: 'p5',
    name: '990 PRO 2TB NVMe SSD',
    brand: 'Samsung',
    category: { name: 'Storage' },
    description:
      'Fast PCIe 4.0 storage with excellent efficiency for large games and creative projects.',
    price: pesoPrice(169),
    stock: 14,
    image:
      'https://images.unsplash.com/photo-1597872200969-2b65d56bd16b?auto=format&fit=crop&w=900&q=85',
    specs: { Capacity: '2TB', Interface: 'PCIe 4.0' },
  },
  {
    _id: 'p6',
    name: 'MAG B650 TOMAHAWK WIFI',
    brand: 'MSI',
    category: { name: 'Motherboards' },
    description:
      'Feature-rich AM5 motherboard with Wi-Fi 6E, strong power delivery, and room to grow.',
    price: pesoPrice(219),
    stock: 5,
    image:
      'https://images.unsplash.com/photo-1518770660439-4636190af475?auto=format&fit=crop&w=900&q=85',
    specs: { Socket: 'AM5', Form: 'ATX' },
  },
  {
    _id: 'p7',
    name: 'RM850e 850W Gold PSU',
    brand: 'Corsair',
    category: { name: 'Power Supplies' },
    description: 'Quiet, fully modular ATX power supply with efficient 80 PLUS Gold performance.',
    price: pesoPrice(119),
    stock: 9,
    image:
      'https://images.unsplash.com/photo-1587202372775-e229f172b9d7?auto=format&fit=crop&w=900&q=85',
    specs: { Wattage: '850W', Rating: '80 PLUS Gold' },
  },
  {
    _id: 'p8',
    name: 'North Mid Tower Case',
    brand: 'Fractal Design',
    category: { name: 'Cases' },
    description:
      'A modern mid tower with natural materials, smart airflow, and generous building space.',
    price: pesoPrice(149),
    stock: 4,
    image:
      'https://images.unsplash.com/photo-1587202372634-32705e3bf49c?auto=format&fit=crop&w=900&q=85',
    specs: { Form: 'ATX', Color: 'Charcoal' },
  },
];
const currency = (n) =>
  new Intl.NumberFormat('en-PH', {
    style: 'currency',
    currency: 'PHP',
    maximumFractionDigits: 0,
  }).format(n);
async function api(path, options = {}) {
  let token = sessionStorage.getItem('csrf') || '';
  const isWrite = !['GET', 'HEAD'].includes(options.method || 'GET');
  const isAuthEntry = ['/auth/login', '/auth/register'].includes(path);
  if (isWrite && (isAuthEntry || !token)) {
    try {
      const csrf = await fetch('/api/csrf', { credentials: 'include' });
      token = (await csrf.json()).token;
      sessionStorage.setItem('csrf', token);
    } catch {}
  }
  const response = await fetch(`/api${path}`, {
    credentials: 'include',
    ...options,
    headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': token, ...options.headers },
  });
  if (response.status === 204) return null;
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const fieldErrors = data.fields?.map((item) => `${item.field}: ${item.message}`).join(', ');
    const error = new Error(fieldErrors || data.error || 'Something went wrong');
    error.status = response.status;
    error.data = data;
    throw error;
  }
  return data;
}

function Icon({ name, size = 19 }) {
  const paths = {
    search: (
      <>
        <circle cx="11" cy="11" r="7" />
        <path d="m20 20-4-4" />
      </>
    ),
    bag: (
      <>
        <path d="M5 8h14l1 13H4L5 8Z" />
        <path d="M9 8a3 3 0 0 1 6 0" />
      </>
    ),
    user: (
      <>
        <circle cx="12" cy="8" r="4" />
        <path d="M5 21a7 7 0 0 1 14 0" />
      </>
    ),
    arrow: (
      <>
        <path d="M5 12h14M13 6l6 6-6 6" />
      </>
    ),
    check: <path d="m5 12 4 4L19 6" />,
    close: <path d="m18 6-12 12M6 6l12 12" />,
    menu: <path d="M4 6h16M4 12h16M4 18h16" />,
    filter: (
      <>
        <path d="M4 6h16M7 12h10m-7 6h4" />
      </>
    ),
    chev: <path d="m6 9 6 6 6-6" />,
  };
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {paths[name]}
    </svg>
  );
}

function App() {
  const [products, setProducts] = useState(demoProducts),
    [categories, setCategories] = useState([
      'All components',
      'Graphics Cards',
      'Processors',
      'Memory',
      'Storage',
      'Motherboards',
      'Power Supplies',
      'Cases',
    ]),
    [categoryIds, setCategoryIds] = useState({});
  const [cart, setCart] = useState(() => JSON.parse(localStorage.getItem('pcmax-cart') || '[]')),
    [user, setUser] = useState(null),
    [query, setQuery] = useState(''),
    [category, setCategory] = useState('All components'),
    [sort, setSort] = useState('featured'),
    [page, setPage] = useState('shop'),
    [selected, setSelected] = useState(null),
    [modal, setModal] = useState(''),
    [notice, setNotice] = useState(''),
    [menu, setMenu] = useState(false),
    [form, setForm] = useState({}),
    [orders, setOrders] = useState([]),
    [profileForm, setProfileForm] = useState({}),
    [profileLoading, setProfileLoading] = useState(false),
    [authFeedback, setAuthFeedback] = useState(null),
    [loginLockedUntil, setLoginLockedUntil] = useState(0),
    [lockCountdown, setLockCountdown] = useState(0),
    [scrollToComponents, setScrollToComponents] = useState(false),
    [productView, setProductView] = useState('grid');
  useEffect(() => {
    api('/products')
      .then((d) => {
        const items = d.products || [];
        setProducts(items);
        setCart((old) =>
          old
            .filter((item) => items.some((product) => product._id === item._id))
            .map((item) => {
              const product = items.find((x) => x._id === item._id);
              return { ...item, ...product, quantity: item.quantity };
            }),
        );
      })
      .catch(() => {});
    api('/categories')
      .then((d) => {
        if (d.categories?.length) {
          setCategories(['All components', ...d.categories.map((c) => c.name)]);
          setCategoryIds(Object.fromEntries(d.categories.map((c) => [c.name, c._id])));
        }
      })
      .catch(() => {});
    api('/auth/me')
      .then((d) => setUser(d.user))
      .catch(() => {});
  }, []);
  useEffect(() => {
    const syncProductRoute = async () => {
      const match = window.location.pathname.match(/^\/products\/([^/]+)$/);
      if (!match) {
        setPage('shop');
        setSelected(null);
        return;
      }
      try {
        const data = await api(`/products/${encodeURIComponent(decodeURIComponent(match[1]))}`);
        setSelected(data.product);
        setPage('detail');
      } catch {
        setPage('shop');
        setSelected(null);
        setNotice('This product is no longer available.');
      }
    };
    syncProductRoute();
    window.addEventListener('popstate', syncProductRoute);
    return () => window.removeEventListener('popstate', syncProductRoute);
  }, []);
  useEffect(() => {
    if (page !== 'shop' || !scrollToComponents) return;
    const frame = requestAnimationFrame(() => {
      document.querySelector('#catalog')?.scrollIntoView({ behavior: 'smooth' });
      setScrollToComponents(false);
    });
    return () => cancelAnimationFrame(frame);
  }, [page, scrollToComponents]);
  useEffect(() => {
    localStorage.setItem('pcmax-cart', JSON.stringify(cart));
  }, [cart]);
  useEffect(() => {
    if (notice) {
      const t = setTimeout(() => setNotice(''), 3000);
      return () => clearTimeout(t);
    }
  }, [notice]);
  useEffect(() => {
    if (!loginLockedUntil) {
      setLockCountdown(0);
      return;
    }
    const updateCountdown = () => {
      const seconds = Math.max(0, Math.ceil((loginLockedUntil - Date.now()) / 1000));
      setLockCountdown(seconds);
      if (seconds === 0) setLoginLockedUntil(0);
    };
    updateCountdown();
    const timer = setInterval(updateCountdown, 250);
    return () => clearInterval(timer);
  }, [loginLockedUntil]);
  const visible = useMemo(
    () =>
      products
        .filter(
          (p) =>
            (category === 'All components' ||
              (typeof p.category === 'string'
                ? p.category === category
                : p.category?.name === category)) &&
            `${p.name} ${p.brand} ${p.category?.name || p.category || ''}`
              .toLowerCase()
              .includes(query.toLowerCase()),
        )
        .sort((a, b) =>
          sort === 'price-asc'
            ? a.price - b.price
            : sort === 'price-desc'
              ? b.price - a.price
              : sort === 'newest'
                ? new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime()
                : sort === 'name'
                  ? a.name.localeCompare(b.name)
                  : (b.featured ? 1 : 0) - (a.featured ? 1 : 0),
        ),
    [products, category, query, sort],
  );
  const count = cart.reduce((n, x) => n + x.quantity, 0),
    subtotal = cart.reduce((n, x) => n + x.price * x.quantity, 0),
    shipping = subtotal >= 16000 ? 0 : 750;
  function add(p) {
    setCart((old) => {
      const found = old.find((x) => x._id === p._id);
      return found
        ? old.map((x) => (x._id === p._id ? { ...x, quantity: Math.min(x.quantity + 1, 20) } : x))
        : [...old, { ...p, quantity: 1 }];
    });
    setNotice('Added to your cart');
  }
  async function authSubmit(e) {
    e.preventDefault();
    if (modal === 'login' && lockCountdown > 0) {
      setAuthFeedback({ type: 'locked' });
      return;
    }
    try {
      const authPayload = {
        email: String(form.email || ''),
        password: String(form.password || ''),
        ...(modal === 'register'
          ? {
              firstName: String(form.firstName || ''),
              lastName: String(form.lastName || ''),
              gender: form.gender,
            }
          : {}),
      };
      const d = await api(`/auth/${modal}`, {
        method: 'POST',
        body: JSON.stringify(authPayload),
      });
      setUser(d.user);
      if (d.csrfToken) sessionStorage.setItem('csrf', d.csrfToken);
      setAuthFeedback(null);
      setLoginLockedUntil(0);
      setModal('');
      setNotice('Welcome to PCMAX');
    } catch (e) {
      if (modal === 'login' && e.status === 423) {
        const seconds = Math.max(1, Number(e.data?.retryAfterSeconds) || 60);
        setLoginLockedUntil(Date.now() + seconds * 1000);
        setAuthFeedback({ type: 'locked' });
      } else if (modal === 'login' && e.status === 401) {
        setAuthFeedback({ type: 'incorrect', attemptsRemaining: e.data?.attemptsRemaining });
      } else {
        setNotice(e.message);
      }
    }
  }
  async function checkout(e) {
    e.preventDefault();
    try {
      await api('/checkout', {
        method: 'POST',
        body: JSON.stringify({
          items: cart.map((p) => ({ productId: p._id, quantity: p.quantity })),
          paymentMethod: form.paymentMethod || 'cod',
          shippingAddress: form.address,
        }),
      });
      setCart([]);
      setPage('orders');
      setNotice('Order placed successfully');
    } catch (e) {
      setNotice(e.message);
    }
  }
  async function loadOrders() {
    if (!user) {
      setModal('login');
      return;
    }
    try {
      const d = await api('/orders/mine');
      setOrders(d.orders || []);
    } catch {
      setOrders([]);
    }
    setPage('orders');
  }
  async function loadProfile() {
    if (!user) {
      setModal('login');
      return;
    }
    setProfileLoading(true);
    try {
      const data = await api('/profile');
      setProfileForm({
        name: data.profile.name || '',
        email: data.profile.email || '',
        birthday: data.profile.birthday || '',
        gender: data.profile.gender || 'prefer_not_to_say',
        address: data.profile.address || '',
        currentPassword: '',
        newPassword: '',
      });
    } catch (e) {
      setNotice(e.message);
    } finally {
      setProfileLoading(false);
    }
  }
  async function saveProfile(e) {
    e.preventDefault();
    const payload = {
      name: profileForm.name,
      email: profileForm.email,
      birthday: profileForm.birthday || '',
      gender: profileForm.gender,
      address: profileForm.address || '',
    };
    if (profileForm.currentPassword) payload.currentPassword = profileForm.currentPassword;
    if (profileForm.newPassword) payload.newPassword = profileForm.newPassword;
    try {
      const data = await api('/profile', { method: 'PUT', body: JSON.stringify(payload) });
      setProfileForm((current) => ({
        ...current,
        ...data.profile,
        currentPassword: '',
        newPassword: '',
      }));
      setUser(data.user);
      setNotice('Your profile details were saved.');
    } catch (e) {
      setNotice(e.message);
    }
  }
  function navigate(p) {
    if (p !== 'detail' && window.location.pathname.startsWith('/products/'))
      window.history.pushState({}, '', '/');
    setPage(p);
    setSelected(null);
    setMenu(false);
    if (p === 'orders') loadOrders();
    if (p === 'profile') loadProfile();
  }
  function openProduct(product) {
    setSelected(product);
    setPage('detail');
    setMenu(false);
    window.history.pushState(
      { product: product._id },
      '',
      `/products/${encodeURIComponent(product.slug || product._id)}`,
    );
  }
  const signOut = async () => {
    try {
      await api('/auth/logout', { method: 'POST' });
    } catch {}
    setUser(null);
    setProfileForm({});
    setProfileLoading(false);
    sessionStorage.removeItem('csrf');
    navigate('shop');
    setNotice('You are signed out');
  };
  return (
    <>
      <div className="announcement">
        <span>Free shipping on orders ₱16,000+</span>
        <span className="announcement-right">
          Built for your next great build <span className="dot">●</span> Secure checkout
        </span>
      </div>
      <header className="header">
        <a className="brand" onClick={() => navigate('shop')} href="#shop">
          <span className="brand-mark">
            P<span>C</span>
          </span>
          <span className="brand-word">
            PCMAX<span className="brand-caption">PC PARTS & COMPONENTS</span>
          </span>
        </a>
        <nav className={menu ? 'nav nav-open' : 'nav'}>
          <a
            className={page === 'shop' ? 'active' : ''}
            href="#shop"
            onClick={() => navigate('shop')}
          >
            Shop
          </a>
          <a
            href="#catalog"
            onClick={() => {
              setCategory('All components');
              setScrollToComponents(true);
              navigate('shop');
            }}
          >
            Components
          </a>
          <a href="#support" onClick={() => setNotice('Our team is here to help with your build.')}>
            Support
          </a>
        </nav>
        <div className="header-actions">
          <button
            className="icon-btn search-trigger"
            aria-label="Focus search"
            onClick={() => document.querySelector('#search')?.focus()}
          >
            <Icon name="search" />
          </button>
          <button
            className="icon-btn"
            aria-label="Account"
            onClick={() => (user ? navigate('profile') : setModal('login'))}
          >
            <Icon name="user" />
          </button>
          <button
            className="cart-trigger"
            onClick={() => navigate('cart')}
            aria-label={`Cart with ${count} items`}
          >
            <Icon name="bag" />
            <span>Cart</span>
            <b>{count}</b>
          </button>
          <button
            className="icon-btn mobile-menu"
            aria-label="Toggle navigation"
            onClick={() => setMenu(!menu)}
          >
            <Icon name="menu" />
          </button>
        </div>
      </header>
      <main>
        {page === 'shop' && (
          <>
            <section className="hero">
              <div className="hero-copy">
                <div className="eyebrow">
                  <span className="eyebrow-line" /> YOUR BUILD STARTS HERE
                </div>
                <h1>
                  Make more
                  <br />
                  of <em>every frame.</em>
                </h1>
                <p>Thoughtful PC components. Expert-picked and ready for your next big idea.</p>
                <button
                  className="button button-blue"
                  onClick={() =>
                    document.querySelector('#catalog')?.scrollIntoView({ behavior: 'smooth' })
                  }
                >
                  Explore components <Icon name="arrow" />
                </button>
                <div className="hero-trust">
                  <span>
                    <b>✓</b> Carefully selected
                  </span>
                  <span>
                    <b>✓</b> Expert support
                  </span>
                </div>
              </div>
              <div className="hero-visual">
                <div className="hero-image" />
                <div className="hero-badge">
                  <span>BUILT FOR</span>
                  <strong>
                    WHAT'S
                    <br />
                    NEXT<span className="badge-period">.</span>
                  </strong>
                  <small>Performance without compromise</small>
                </div>
                <div className="hero-index">
                  01 <span /> 03
                </div>
                <div className="visual-label">
                  THE PCMAX EDITION <b>001 — 2026</b>
                </div>
              </div>
              <div className="hero-side">PERFORMANCE, CONSIDERED</div>
            </section>
            <div className="benefits">
              <div>
                <span className="benefit-icon">↗</span>
                <span>
                  <b>Fast, careful shipping</b>
                  <small>Free from ₱16,000</small>
                </span>
              </div>
              <div>
                <span className="benefit-icon">◈</span>
                <span>
                  <b>Components we trust</b>
                  <small>Curated by PC builders</small>
                </span>
              </div>
              <div>
                <span className="benefit-icon">⌁</span>
                <span>
                  <b>Here to help you build</b>
                  <small>Real support from our team</small>
                </span>
              </div>
              <div>
                <span className="benefit-icon">✓</span>
                <span>
                  <b>Secure, simple checkout</b>
                  <small>Shop with confidence</small>
                </span>
              </div>
            </div>
            <section className="catalog section-wrap" id="catalog">
              <div className="section-heading">
                <div>
                  <div className="eyebrow">THE PCMAX COLLECTION</div>
                  <h2>
                    Components for
                    <br className="mobile-break" /> <em>what's next.</em>
                  </h2>
                </div>
                <span className="catalog-count">
                  {visible.length.toString().padStart(2, '0')} COMPONENTS
                </span>
              </div>
              <div className="catalog-tools">
                <div className="filter-list">
                  <button className="filter-icon" aria-label="Filters">
                    <Icon name="filter" />
                  </button>
                  {categories.map((c) => (
                    <button
                      key={c}
                      className={category === c ? 'filter active-filter' : 'filter'}
                      onClick={() => setCategory(c)}
                    >
                      {c}
                    </button>
                  ))}
                </div>
                <div className="search-sort">
                  <label className="searchbox">
                    <Icon name="search" />
                    <input
                      id="search"
                      value={query}
                      onChange={(e) => setQuery(e.target.value)}
                      placeholder="Search components"
                    />
                    <kbd>⌘ K</kbd>
                  </label>
                  <select
                    aria-label="Sort products"
                    value={sort}
                    onChange={(e) => setSort(e.target.value)}
                  >
                    <option value="featured">Featured</option>
                    <option value="price-asc">Price: low to high</option>
                    <option value="price-desc">Price: high to low</option>
                    <option value="name">Name</option>
                  </select>
                </div>
              </div>
              <div className="product-grid">
                {visible.map((p, i) => (
                  <article className="product-card" key={p._id}>
                    <button className="product-image" onClick={() => openProduct(p)}>
                      <img
                        src={p.image || demoProducts[i % demoProducts.length].image}
                        alt={p.name}
                      />
                      {(p.featured || i === 0) && <span className="product-tag">PCMAX PICK</span>}
                      <span className="image-arrow">
                        <Icon name="arrow" size={16} />
                      </span>
                    </button>
                    <div className="product-info">
                      <div className="product-meta">
                        <span>{p.brand}</span>
                        <span className={p.stock > 0 ? 'stock' : 'stock out'}>
                          {p.stock > 0 ? 'IN STOCK' : 'SOLD OUT'}
                        </span>
                      </div>
                      <button className="product-name" onClick={() => openProduct(p)}>
                        {p.name}
                      </button>
                      <div className="product-bottom">
                        <b>{currency(p.price)}</b>
                        <button className="add-button" onClick={() => add(p)} disabled={!p.stock}>
                          Add to cart <span>+</span>
                        </button>
                      </div>
                    </div>
                  </article>
                ))}
              </div>
              {visible.length === 0 && (
                <div className="empty-state">No components match. Try a different search.</div>
              )}
              <div className="catalog-bottom">
                <span>
                  Showing {visible.length} of {products.length} components
                </span>
                <button
                  onClick={() => {
                    setCategory('All components');
                    setQuery('');
                    setSort('newest');
                    setPage('all-products');
                  }}
                >
                  View all components <Icon name="arrow" size={16} />
                </button>
              </div>
            </section>
          </>
        )}
        {page === 'all-products' && (
          <section className="all-products page-section section-wrap">
            <button className="back-link" onClick={() => navigate('shop')}>
              ← Back to storefront
            </button>
            <div className="all-products-heading">
              <div>
                <div className="eyebrow">THE COMPLETE PCMAX CATALOG</div>
                <h1>
                  All components<span className="blue-period">.</span>
                </h1>
                <p>Explore every product in the collection.</p>
              </div>
              <span className="catalog-count">
                {visible.length.toString().padStart(2, '0')} PRODUCTS
              </span>
            </div>
            <div className="all-products-toolbar">
              <label className="searchbox">
                <Icon name="search" />
                <input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search all products"
                  aria-label="Search all products"
                />
              </label>
              <label className="all-sort-label">
                Sort by
                <select
                  aria-label="Sort all products"
                  value={sort}
                  onChange={(e) => setSort(e.target.value)}
                >
                  <option value="newest">Newest to oldest</option>
                  <option value="price-desc">Highest price to lowest</option>
                  <option value="price-asc">Lowest price to highest</option>
                  <option value="name">Name</option>
                </select>
              </label>
              <div className="view-switch" role="group" aria-label="Product layout">
                <button
                  className={productView === 'grid' ? 'selected-view' : ''}
                  aria-pressed={productView === 'grid'}
                  onClick={() => setProductView('grid')}
                >
                  Grid
                </button>
                <button
                  className={productView === 'list' ? 'selected-view' : ''}
                  aria-pressed={productView === 'list'}
                  onClick={() => setProductView('list')}
                >
                  List
                </button>
              </div>
            </div>
            <div className={`all-product-grid ${productView === 'list' ? 'list-view' : ''}`}>
              {visible.map((p, i) => (
                <article className="product-card all-product-card" key={p._id}>
                  <button className="product-image" onClick={() => openProduct(p)}>
                    <img
                      src={p.image || demoProducts[i % demoProducts.length].image}
                      alt={p.name}
                    />
                    <span className="image-arrow">
                      <Icon name="arrow" size={16} />
                    </span>
                  </button>
                  <div className="product-info">
                    <div className="product-meta">
                      <span>{p.brand}</span>
                      <span>{p.category?.name || p.category}</span>
                    </div>
                    <button className="product-name" onClick={() => openProduct(p)}>
                      {p.name}
                    </button>
                    <p className="all-product-description">{p.description}</p>
                    <div className="product-bottom">
                      <div>
                        <b>{currency(p.price)}</b>
                        <span className={p.stock > 0 ? 'stock' : 'stock out'}>
                          {p.stock > 0 ? 'IN STOCK' : 'SOLD OUT'}
                        </span>
                      </div>
                      <button className="add-button" onClick={() => add(p)} disabled={!p.stock}>
                        Add to cart <span>+</span>
                      </button>
                    </div>
                  </div>
                </article>
              ))}
            </div>
            {visible.length === 0 && (
              <div className="empty-state">No products match your search.</div>
            )}
          </section>
        )}
        {page === 'detail' && selected && (
          <section className="detail section-wrap">
            <button className="back-link" onClick={() => navigate('shop')}>
              ← Back to components
            </button>
            <div className="detail-grid">
              <img className="detail-image" src={selected.image} alt={selected.name} />
              <div>
                <div className="eyebrow">
                  {selected.brand} · {selected.category?.name || selected.category}
                </div>
                <h1>{selected.name}</h1>
                <p className="detail-description">{selected.description}</p>
                <div className="detail-price">{currency(selected.price)}</div>
                <p className="detail-stock">
                  {selected.stock ? `${selected.stock} in stock` : 'Currently unavailable'}
                </p>
                <button
                  className="button button-blue"
                  disabled={!selected.stock}
                  onClick={() => add(selected)}
                >
                  Add to cart <Icon name="bag" />
                </button>
                <h3>Specifications</h3>
                {Object.entries(selected.specs || {}).length ? (
                  Object.entries(selected.specs || {}).map(([k, v]) => (
                    <div className="spec-row" key={k}>
                      <span>{k}</span>
                      <b>{v}</b>
                    </div>
                  ))
                ) : (
                  <p className="spec-empty">Specifications are being updated.</p>
                )}
              </div>
            </div>
          </section>
        )}
        {page === 'cart' && (
          <section className="page-section section-wrap">
            <div className="eyebrow">YOUR SELECTION</div>
            <h1>
              Your cart<span className="blue-period">.</span>
            </h1>
            {!cart.length ? (
              <div className="empty-state">
                Your cart is ready for something great.{' '}
                <button className="text-link" onClick={() => navigate('shop')}>
                  Explore components →
                </button>
              </div>
            ) : (
              <div className="cart-layout">
                <div className="cart-lines">
                  {cart.map((p) => (
                    <div className="cart-line" key={p._id}>
                      <img src={p.image} alt="" />
                      <div className="cart-line-info">
                        <b>{p.name}</b>
                        <span>{p.brand}</span>
                        <strong>{currency(p.price)}</strong>
                      </div>
                      <div className="quantity">
                        <button
                          onClick={() =>
                            setCart(
                              cart.map((x) =>
                                x._id === p._id
                                  ? { ...x, quantity: Math.max(1, x.quantity - 1) }
                                  : x,
                              ),
                            )
                          }
                        >
                          −
                        </button>
                        <span>{p.quantity}</span>
                        <button
                          onClick={() =>
                            setCart(
                              cart.map((x) =>
                                x._id === p._id
                                  ? { ...x, quantity: Math.min(20, x.quantity + 1) }
                                  : x,
                              ),
                            )
                          }
                        >
                          +
                        </button>
                      </div>
                      <button
                        className="remove"
                        aria-label="Remove item"
                        onClick={() => setCart(cart.filter((x) => x._id !== p._id))}
                      >
                        ×
                      </button>
                    </div>
                  ))}
                </div>
                <aside className="summary">
                  <h3>Order summary</h3>
                  <div>
                    <span>Subtotal</span>
                    <b>{currency(subtotal)}</b>
                  </div>
                  <div>
                    <span>Shipping</span>
                    <b>{shipping ? currency(shipping) : 'Free'}</b>
                  </div>
                  <div className="summary-total">
                    <span>Total</span>
                    <b>{currency(subtotal + shipping)}</b>
                  </div>
                  <button
                    className="button button-blue full-button"
                    onClick={() => {
                      if (!user) setModal('login');
                      else navigate('checkout');
                    }}
                  >
                    Continue to checkout <Icon name="arrow" />
                  </button>
                  <small>Shipping calculated at checkout</small>
                </aside>
              </div>
            )}
          </section>
        )}
        {page === 'checkout' && (
          <section className="page-section section-wrap">
            <div className="eyebrow">ALMOST THERE</div>
            <h1>
              Checkout<span className="blue-period">.</span>
            </h1>
            <div className="checkout-layout">
              <form className="checkout-form" onSubmit={checkout}>
                <h2>Delivery details</h2>
                <label>
                  Full name
                  <input
                    required
                    minLength="2"
                    value={form.name || user?.name || ''}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                  />
                </label>
                <label>
                  Email address
                  <input
                    type="email"
                    required
                    value={form.email || user?.email || ''}
                    onChange={(e) => setForm({ ...form, email: e.target.value })}
                  />
                </label>
                <label>
                  Shipping address
                  <textarea
                    required
                    minLength="8"
                    rows="3"
                    value={form.address || ''}
                    onChange={(e) => setForm({ ...form, address: e.target.value })}
                  />
                </label>
                <h2>Payment method</h2>
                <label className="radio-label">
                  <input
                    type="radio"
                    name="paymentMethod"
                    checked={(form.paymentMethod || 'cod') === 'cod'}
                    onChange={() => setForm({ ...form, paymentMethod: 'cod' })}
                  />{' '}
                  Cash on delivery <span>Pay when your order arrives</span>
                </label>
                <label className="radio-label">
                  <input
                    type="radio"
                    name="paymentMethod"
                    checked={form.paymentMethod === 'manual'}
                    onChange={() => setForm({ ...form, paymentMethod: 'manual' })}
                  />{' '}
                  Manual payment confirmation{' '}
                  <span>We will contact you with payment instructions</span>
                </label>
                <button className="button button-blue full-button">
                  Place order · {currency(subtotal + shipping)}
                </button>
              </form>
              <aside className="summary">
                <h3>Your order</h3>
                {cart.map((p) => (
                  <div key={p._id}>
                    <span>
                      {p.quantity} × {p.name}
                    </span>
                    <b>{currency(p.quantity * p.price)}</b>
                  </div>
                ))}
                <div>
                  <span>Shipping</span>
                  <b>{shipping ? currency(shipping) : 'Free'}</b>
                </div>
                <div className="summary-total">
                  <span>Total</span>
                  <b>{currency(subtotal + shipping)}</b>
                </div>
              </aside>
            </div>
          </section>
        )}
        {page === 'profile' && (
          <section className="page-section section-wrap">
            <div className="eyebrow">YOUR ACCOUNT</div>
            <h1>
              Profile<span className="blue-period">.</span>
            </h1>
            {profileLoading ? (
              <div className="empty-state">Loading your profile…</div>
            ) : (
              <form className="profile-edit" onSubmit={saveProfile}>
                <div className="profile-edit-heading">
                  <div>
                    <h2>Your details</h2>
                    <p>
                      {user?.role === 'admin' ? 'Administrator account' : 'PCMAX customer account'}
                    </p>
                  </div>
                  <div className="profile-links">
                    <button type="button" className="button button-outline" onClick={loadOrders}>
                      Order history
                    </button>
                    <button type="button" className="text-link" onClick={signOut}>
                      Sign out
                    </button>
                  </div>
                </div>
                <div className="profile-fields">
                  <label>
                    Full name
                    <input
                      required
                      minLength="2"
                      maxLength="100"
                      autoComplete="name"
                      value={profileForm.name || ''}
                      onChange={(e) => setProfileForm({ ...profileForm, name: e.target.value })}
                    />
                  </label>
                  <label>
                    Email address
                    <input
                      required
                      type="email"
                      autoComplete="email"
                      value={profileForm.email || ''}
                      onChange={(e) => setProfileForm({ ...profileForm, email: e.target.value })}
                    />
                  </label>
                  <label>
                    Birthday
                    <input
                      type="date"
                      max={new Date().toISOString().slice(0, 10)}
                      value={profileForm.birthday || ''}
                      onChange={(e) => setProfileForm({ ...profileForm, birthday: e.target.value })}
                    />
                  </label>
                  <label>
                    Gender
                    <select
                      required
                      value={profileForm.gender || 'prefer_not_to_say'}
                      onChange={(e) => setProfileForm({ ...profileForm, gender: e.target.value })}
                    >
                      <option value="female">Female</option>
                      <option value="male">Male</option>
                      <option value="nonbinary">Non-binary</option>
                      <option value="prefer_not_to_say">Prefer not to say</option>
                    </select>
                  </label>
                  <label className="profile-address">
                    Address
                    <textarea
                      rows="3"
                      maxLength="500"
                      autoComplete="street-address"
                      value={profileForm.address || ''}
                      onChange={(e) => setProfileForm({ ...profileForm, address: e.target.value })}
                    />
                  </label>
                </div>
                <div className="password-change">
                  <div>
                    <h3>Change email or password</h3>
                    <p>Enter your current password when changing either one.</p>
                  </div>
                  <label>
                    Current password
                    <input
                      type="password"
                      autoComplete="current-password"
                      value={profileForm.currentPassword || ''}
                      onChange={(e) =>
                        setProfileForm({ ...profileForm, currentPassword: e.target.value })
                      }
                    />
                  </label>
                  <label>
                    New password
                    <input
                      type="password"
                      minLength="10"
                      autoComplete="new-password"
                      placeholder="Leave blank to keep your current password"
                      value={profileForm.newPassword || ''}
                      onChange={(e) =>
                        setProfileForm({ ...profileForm, newPassword: e.target.value })
                      }
                    />
                  </label>
                </div>
                <div className="profile-save-row">
                  <span>Changes are saved to your PCMAX account.</span>
                  <button className="button button-blue" type="submit">
                    Save changes <Icon name="check" />
                  </button>
                </div>
              </form>
            )}
            {user?.role === 'admin' && (
              <div className="admin-box">
                <h2>Admin dashboard</h2>
                <p>Manage your store catalog and operations.</p>
                <button className="button button-blue" onClick={() => navigate('admin')}>
                  Open dashboard <Icon name="arrow" />
                </button>
              </div>
            )}
          </section>
        )}
        {page === 'orders' && (
          <section className="page-section section-wrap">
            <div className="eyebrow">YOUR PCMAX PURCHASES</div>
            <h1>
              Order history<span className="blue-period">.</span>
            </h1>
            {!orders.length ? (
              <div className="empty-state">
                No orders yet.{' '}
                <button className="text-link" onClick={() => navigate('shop')}>
                  Find your next component →
                </button>
              </div>
            ) : (
              orders.map((o) => (
                <div className="order-card" key={o._id}>
                  <div>
                    <b>Order {o._id.slice(-8).toUpperCase()}</b>
                    <span>
                      {new Date(o.createdAt).toLocaleDateString()} · {o.status}
                    </span>
                  </div>
                  <span>{o.items?.length} items</span>
                  <strong>{currency(o.total)}</strong>
                </div>
              ))
            )}
          </section>
        )}
        {page === 'admin' && user?.role === 'admin' && (
          <Admin
            api={api}
            products={products}
            setProducts={setProducts}
            categories={categories}
            categoryIds={categoryIds}
            setCategoryIds={setCategoryIds}
            setCategories={setCategories}
            setNotice={setNotice}
          />
        )}
      </main>
      <footer id="support">
        <div className="footer-main">
          <div>
            <a className="brand footer-brand" href="#shop" onClick={() => navigate('shop')}>
              <span className="brand-mark">
                P<span>C</span>
              </span>
              <span className="brand-word">
                PCMAX<span className="brand-caption">PC PARTS & COMPONENTS</span>
              </span>
            </a>
            <p>Better parts for what comes next.</p>
          </div>
          <div>
            <b>EXPLORE</b>
            <a onClick={() => navigate('shop')}>Shop all</a>
            <a
              onClick={() => {
                setCategory('Graphics Cards');
                navigate('shop');
              }}
            >
              Graphics cards
            </a>
            <a
              onClick={() => {
                setCategory('Processors');
                navigate('shop');
              }}
            >
              Processors
            </a>
          </div>
          <div>
            <b>SUPPORT</b>
            <a onClick={() => setNotice('Contact support: support@pcmax.example')}>Contact us</a>
            <a onClick={() => setNotice('Returns are available within 30 days of delivery.')}>
              Shipping & returns
            </a>
            <a onClick={loadOrders}>Order status</a>
          </div>
          <div>
            <b>STAY IN THE LOOP</b>
            <p>New parts, helpful guides, no noise.</p>
            <form
              className="subscribe"
              onSubmit={(e) => {
                e.preventDefault();
                setNotice('Thanks for subscribing!');
              }}
            >
              <input
                type="email"
                required
                placeholder="Your email address"
                aria-label="Your email address"
              />
              <button aria-label="Subscribe">
                <Icon name="arrow" />
              </button>
            </form>
          </div>
        </div>
        <div className="footer-bottom">
          <span>© 2026 PCMAX. Built for your next great build.</span>
          <span>Thoughtful components. Better builds.</span>
          <span>Privacy&nbsp;&nbsp;·&nbsp;&nbsp;Terms</span>
        </div>
      </footer>
      {notice && (
        <div className="toast" role="status">
          <span>✓</span>
          {notice}
          <button aria-label="Dismiss" onClick={() => setNotice('')}>
            ×
          </button>
        </div>
      )}
      {modal && (
        <div className="modal-backdrop" onClick={() => setModal('')}>
          <form className="auth-modal" onClick={(e) => e.stopPropagation()} onSubmit={authSubmit}>
            <button type="button" className="modal-close" onClick={() => setModal('')}>
              <Icon name="close" />
            </button>
            <div className="eyebrow">WELCOME TO PCMAX</div>
            <h2>{modal === 'login' ? 'Good to see you.' : 'Create your account.'}</h2>
            {modal === 'register' && (
              <>
                <label>
                  First name
                  <input
                    required
                    maxLength="50"
                    autoComplete="given-name"
                    value={form.firstName || ''}
                    onChange={(e) => setForm({ ...form, firstName: e.target.value })}
                  />
                </label>
                <label>
                  Last name
                  <input
                    required
                    maxLength="50"
                    autoComplete="family-name"
                    value={form.lastName || ''}
                    onChange={(e) => setForm({ ...form, lastName: e.target.value })}
                  />
                </label>
              </>
            )}
            <label>
              Email address
              <input
                required
                type="email"
                value={form.email || ''}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
              />
            </label>
            <label>
              Password
              <input
                required
                type="password"
                minLength={modal === 'register' ? 10 : 1}
                value={form.password || ''}
                onChange={(e) => setForm({ ...form, password: e.target.value })}
              />
            </label>
            {modal === 'register' && (
              <label>
                Gender
                <select
                  required
                  value={form.gender || ''}
                  onChange={(e) => setForm({ ...form, gender: e.target.value })}
                >
                  <option value="" disabled>
                    Select an option
                  </option>
                  <option value="female">Female</option>
                  <option value="male">Male</option>
                  <option value="nonbinary">Non-binary</option>
                  <option value="prefer_not_to_say">Prefer not to say</option>
                </select>
              </label>
            )}
            <button
              className="button button-blue full-button"
              disabled={modal === 'login' && lockCountdown > 0}
            >
              {modal === 'login' && lockCountdown > 0
                ? `Try again in ${String(Math.floor(lockCountdown / 60)).padStart(2, '0')}:${String(lockCountdown % 60).padStart(2, '0')}`
                : modal === 'login'
                  ? 'Sign in'
                  : 'Create account'}{' '}
              {!(modal === 'login' && lockCountdown > 0) && <Icon name="arrow" />}
            </button>
            <p>
              {modal === 'login' ? 'New to PCMAX?' : 'Already have an account?'}{' '}
              <button
                type="button"
                className="text-link"
                onClick={() => setModal(modal === 'login' ? 'register' : 'login')}
              >
                {modal === 'login' ? 'Create an account' : 'Sign in'}
              </button>
            </p>
          </form>
        </div>
      )}
      {authFeedback && (
        <div className="modal-backdrop feedback-backdrop">
          <div className="auth-modal feedback-modal" role="alertdialog" aria-modal="true">
            <div className="eyebrow">PCMAX ACCOUNT SECURITY</div>
            <h2>{authFeedback.type === 'locked' ? 'Sign-in paused.' : 'Sign-in didn’t work.'}</h2>
            <p>
              {authFeedback.type === 'locked'
                ? lockCountdown > 0
                  ? `Three incorrect attempts. Try again in ${String(Math.floor(lockCountdown / 60)).padStart(2, '0')}:${String(lockCountdown % 60).padStart(2, '0')}.`
                  : 'Your one-minute sign-in pause has ended. You can try again now.'
                : 'The email or password is incorrect.'}
            </p>
            {authFeedback.type === 'incorrect' && authFeedback.attemptsRemaining > 0 && (
              <p>{authFeedback.attemptsRemaining} attempt(s) remain before a one-minute pause.</p>
            )}
            <button
              className="button button-blue full-button"
              onClick={() => setAuthFeedback(null)}
            >
              Back to sign in
            </button>
          </div>
        </div>
      )}
    </>
  );
}

function Admin({
  api,
  products,
  setProducts,
  categories,
  categoryIds,
  setCategoryIds,
  setCategories,
  setNotice,
}) {
  const [overview, setOverview] = useState(null),
    [tab, setTab] = useState('products'),
    [customers, setCustomers] = useState([]),
    [orders, setOrders] = useState([]),
    [logs, setLogs] = useState([]),
    [show, setShow] = useState(false),
    [form, setForm] = useState({}),
    [specRows, setSpecRows] = useState([{ key: '', value: '' }]),
    [showCategory, setShowCategory] = useState(false);
  useEffect(() => {
    api('/admin/overview')
      .then((d) => setOverview(d.overview))
      .catch(() => {});
    api('/admin/customers')
      .then((d) => setCustomers(d.customers || []))
      .catch(() => {});
    api('/admin/orders')
      .then((d) => setOrders(d.orders || []))
      .catch(() => {});
    api('/admin/audit')
      .then((d) => setLogs(d.logs || []))
      .catch(() => {});
  }, []);
  async function save(e) {
    e.preventDefault();
    try {
      const p = {
        name: String(form.name || ''),
        category: String(form.category || ''),
        brand: String(form.brand || 'PCMAX'),
        description: String(form.description || ''),
        price: Number(form.price),
        stock: Number(form.stock),
        image: String(form.image || ''),
        specs: Object.fromEntries(
          specRows
            .map(({ key, value }) => [String(key || '').trim(), String(value || '').trim()])
            .filter(([key, value]) => key && value),
        ),
      };
      await api('/admin/products', { method: 'POST', body: JSON.stringify(p) });
      const d = await api('/admin/products');
      setProducts(d.products);
      setShow(false);
      setForm({});
      setSpecRows([{ key: '', value: '' }]);
      setNotice('Product created');
    } catch (e) {
      setNotice(e.message);
    }
  }
  async function archive(id) {
    try {
      await api(`/admin/products/${id}`, { method: 'DELETE' });
      setProducts(products.filter((p) => p._id !== id));
      setNotice('Product archived');
    } catch (e) {
      setNotice(e.message);
    }
  }
  async function createCategory(e) {
    e.preventDefault();
    try {
      const d = await api('/admin/categories', {
        method: 'POST',
        body: JSON.stringify({
          name: form.categoryName,
          description: form.categoryDescription || '',
        }),
      });
      setCategories([...categories, d.category.name]);
      setCategoryIds({ ...categoryIds, [d.category.name]: d.category._id });
      setShowCategory(false);
      setForm({});
      setNotice('Category created');
    } catch (e) {
      setNotice(e.message);
    }
  }
  async function deleteCategory(name) {
    const id = categoryIds[name];
    try {
      await api(`/admin/categories/${id}`, { method: 'DELETE' });
      setCategories(categories.filter((c) => c !== name));
      const next = { ...categoryIds };
      delete next[name];
      setCategoryIds(next);
      setNotice('Category deleted');
    } catch (e) {
      setNotice(e.message);
    }
  }
  const validCategories = categories.filter((name) =>
    /^[a-f\d]{24}$/i.test(categoryIds[name] || ''),
  );
  return (
    <section className="page-section section-wrap admin-page">
      <div className="eyebrow">PCMAX STORE OPERATIONS</div>
      <h1>
        Admin dashboard<span className="blue-period">.</span>
      </h1>
      <div className="admin-stats">
        {[
          ['Products', overview?.products ?? products.length],
          ['Orders', overview?.orders ?? orders.length],
          ['Customers', overview?.customers ?? customers.length],
          ['Revenue', currency(overview?.revenue || 0)],
        ].map((x) => (
          <div key={x[0]}>
            <span>{x[0]}</span>
            <b>{x[1]}</b>
          </div>
        ))}
      </div>
      <div className="admin-tabs">
        {['products', 'categories', 'orders', 'customers', 'audit'].map((x) => (
          <button className={tab === x ? 'admin-tab-active' : ''} onClick={() => setTab(x)}>
            {x}
          </button>
        ))}
        {tab === 'products' && (
          <button
            className="button button-blue"
            disabled={validCategories.length === 0}
            title={
              validCategories.length === 0 ? 'Waiting for product categories to load' : undefined
            }
            onClick={() => {
              setForm({});
              setSpecRows([{ key: '', value: '' }]);
              setShow(true);
            }}
          >
            + Add product
          </button>
        )}
        {tab === 'categories' && (
          <button className="button button-blue" onClick={() => setShowCategory(true)}>
            + Add category
          </button>
        )}
      </div>
      {tab === 'products' && (
        <div className="admin-table">
          {products.map((p) => (
            <div className="admin-row" key={p._id}>
              <img src={p.image} alt="" />
              <b>{p.name}</b>
              <span>{typeof p.category === 'object' ? p.category?.name : p.category}</span>
              <span>{p.stock} in stock</span>
              <strong>{currency(p.price)}</strong>
              <button className="text-link" onClick={() => archive(p._id)}>
                Archive
              </button>
            </div>
          ))}
        </div>
      )}
      {tab === 'categories' && (
        <div className="admin-table">
          {categories
            .filter((c) => c !== 'All components')
            .map((c) => (
              <div className="admin-row" key={c}>
                <b>{c}</b>
                <span>{categoryIds[c]}</span>
                <button className="text-link" onClick={() => deleteCategory(c)}>
                  Delete
                </button>
              </div>
            ))}
        </div>
      )}
      {tab === 'orders' && (
        <div className="admin-table">
          {orders.map((o) => (
            <div className="admin-row" key={o._id}>
              <b>#{o._id.slice(-8).toUpperCase()}</b>
              <span>{o.user?.name || 'Customer'}</span>
              <span>{new Date(o.createdAt).toLocaleDateString()}</span>
              <strong>{currency(o.total)}</strong>
              <select
                value={o.status}
                onChange={async (e) => {
                  try {
                    await api(`/admin/orders/${o._id}`, {
                      method: 'PATCH',
                      body: JSON.stringify({ status: e.target.value }),
                    });
                    setOrders(
                      orders.map((x) => (x._id === o._id ? { ...x, status: e.target.value } : x)),
                    );
                  } catch (err) {
                    setNotice(err.message);
                  }
                }}
              >
                {['processing', 'shipped', 'delivered', 'cancelled'].map((s) => (
                  <option key={s}>{s}</option>
                ))}
              </select>
              <select
                value={o.paymentStatus}
                onChange={async (e) => {
                  try {
                    await api(`/admin/orders/${o._id}`, {
                      method: 'PATCH',
                      body: JSON.stringify({ paymentStatus: e.target.value }),
                    });
                    setOrders(
                      orders.map((x) =>
                        x._id === o._id ? { ...x, paymentStatus: e.target.value } : x,
                      ),
                    );
                  } catch (err) {
                    setNotice(err.message);
                  }
                }}
              >
                <option>pending</option>
                <option>confirmed</option>
              </select>
            </div>
          ))}
        </div>
      )}
      {tab === 'customers' && (
        <div className="admin-table">
          {customers.map((c) => (
            <div className="admin-row" key={c._id}>
              <b>{c.name}</b>
              <span>{c.email}</span>
              <span>{c.phone || '—'}</span>
              <span>{new Date(c.createdAt).toLocaleDateString()}</span>
            </div>
          ))}
        </div>
      )}
      {tab === 'audit' && (
        <div className="admin-table">
          {logs.map((l) => (
            <div className="admin-row" key={l._id}>
              <b>{l.action}</b>
              <span>{l.actor?.email || 'System'}</span>
              <span>{l.target}</span>
              <span>{new Date(l.createdAt).toLocaleString()}</span>
            </div>
          ))}
        </div>
      )}
      {(show || showCategory) && (
        <div
          className="modal-backdrop"
          onClick={() => {
            setShow(false);
            setShowCategory(false);
          }}
        >
          <form
            className="auth-modal admin-form"
            onClick={(e) => e.stopPropagation()}
            onSubmit={show ? save : createCategory}
          >
            <button
              type="button"
              className="modal-close"
              onClick={() => {
                setShow(false);
                setShowCategory(false);
              }}
            >
              ×
            </button>
            <div className="eyebrow">CATALOG MANAGEMENT</div>
            <h2>{show ? 'Add a product' : 'Add a category'}</h2>
            {show ? (
              <>
                <label>
                  Product name
                  <input
                    required
                    minLength="2"
                    value={form.name || ''}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                  />
                </label>
                <label>
                  Brand
                  <input
                    required
                    value={form.brand || ''}
                    onChange={(e) => setForm({ ...form, brand: e.target.value })}
                  />
                </label>
                <label>
                  Category
                  <select
                    required
                    value={form.category || ''}
                    onChange={(e) => setForm({ ...form, category: e.target.value })}
                  >
                    <option value="">Select category</option>
                    {validCategories.map((x) => (
                      <option key={x} value={categoryIds[x]}>
                        {x}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  Price (PHP)
                  <input
                    required
                    type="number"
                    min="0"
                    step="0.01"
                    value={form.price || ''}
                    onChange={(e) => setForm({ ...form, price: e.target.value })}
                  />
                </label>
                <label>
                  Stock
                  <input
                    required
                    type="number"
                    min="0"
                    value={form.stock || ''}
                    onChange={(e) => setForm({ ...form, stock: e.target.value })}
                  />
                </label>
                <label>
                  Image URL
                  <input
                    type="url"
                    value={form.image || ''}
                    onChange={(e) => setForm({ ...form, image: e.target.value })}
                  />
                </label>
                <label>
                  Description
                  <textarea
                    required
                    value={form.description || ''}
                    onChange={(e) => setForm({ ...form, description: e.target.value })}
                  />
                </label>
                <div className="spec-editor">
                  <div className="spec-editor-heading">
                    <div>
                      <b>Product specifications</b>
                      <span>These appear on the product detail page.</span>
                    </div>
                    <button
                      type="button"
                      className="text-link"
                      onClick={() => setSpecRows([...specRows, { key: '', value: '' }])}
                    >
                      + Add row
                    </button>
                  </div>
                  {specRows.map((row, index) => (
                    <div className="spec-editor-row" key={index}>
                      <input
                        aria-label={`Specification ${index + 1} name`}
                        placeholder="e.g. Memory"
                        maxLength="60"
                        value={row.key}
                        onChange={(e) =>
                          setSpecRows(
                            specRows.map((item, i) =>
                              i === index ? { ...item, key: e.target.value } : item,
                            ),
                          )
                        }
                      />
                      <input
                        aria-label={`Specification ${index + 1} value`}
                        placeholder="e.g. 12GB GDDR6X"
                        maxLength="200"
                        value={row.value}
                        onChange={(e) =>
                          setSpecRows(
                            specRows.map((item, i) =>
                              i === index ? { ...item, value: e.target.value } : item,
                            ),
                          )
                        }
                      />
                      {specRows.length > 1 && (
                        <button
                          type="button"
                          className="spec-remove"
                          aria-label={`Remove specification ${index + 1}`}
                          onClick={() => setSpecRows(specRows.filter((_, i) => i !== index))}
                        >
                          ×
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </>
            ) : (
              <>
                <label>
                  Category name
                  <input
                    required
                    minLength="2"
                    value={form.categoryName || ''}
                    onChange={(e) => setForm({ ...form, categoryName: e.target.value })}
                  />
                </label>
                <label>
                  Description
                  <input
                    value={form.categoryDescription || ''}
                    onChange={(e) => setForm({ ...form, categoryDescription: e.target.value })}
                  />
                </label>
              </>
            )}
            <button className="button button-blue full-button">
              {show ? 'Save product' : 'Save category'}
            </button>
          </form>
        </div>
      )}
    </section>
  );
}

createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);

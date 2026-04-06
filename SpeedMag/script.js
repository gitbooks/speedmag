/* ==========================================
   SpeedMag — script.js
   Canvas particles, scroll animations, interactions
   ========================================== */

document.addEventListener('DOMContentLoaded', () => {

    // ===== PARTICLE CANVAS =====
    const canvas = document.getElementById('hero-canvas');
    if (canvas) {
        const ctx = canvas.getContext('2d');
        let particles = [];
        let mouse = { x: null, y: null };
        let animFrame;

        function resize() {
            canvas.width = window.innerWidth;
            canvas.height = window.innerHeight;
        }
        resize();
        window.addEventListener('resize', resize);

        canvas.addEventListener('mousemove', e => {
            mouse.x = e.clientX;
            mouse.y = e.clientY;
        });

        canvas.addEventListener('mouseleave', () => {
            mouse.x = null;
            mouse.y = null;
        });

        class Particle {
            constructor() { this.reset(); }

            reset() {
                this.x = canvas.width / 2 + (Math.random() - 0.5) * 100;
                this.y = canvas.height / 2 + (Math.random() - 0.5) * 100;
                this.angle = Math.random() * Math.PI * 2;
                this.speed = Math.random() * 1.5 + 0.3;
                this.radius = Math.random() * 1.8 + 0.2;
                this.opacity = Math.random() * 0.5 + 0.1;
                this.hue = Math.random() > 0.5 ? 160 : 90; // emerald or lime
                this.life = 0;
                this.maxLife = Math.random() * 200 + 100;
            }

            update() {
                this.x += Math.cos(this.angle) * this.speed;
                this.y += Math.sin(this.angle) * this.speed;
                this.life++;

                // Subtle mouse attraction
                if (mouse.x !== null) {
                    const dx = mouse.x - this.x;
                    const dy = mouse.y - this.y;
                    const dist = Math.sqrt(dx * dx + dy * dy);
                    if (dist < 200) {
                        this.x += dx * 0.002;
                        this.y += dy * 0.002;
                    }
                }

                // Fade out near end of life
                const lifeRatio = this.life / this.maxLife;
                this.currentOpacity = this.opacity * (1 - lifeRatio);

                if (this.life >= this.maxLife || this.isOffscreen()) {
                    this.reset();
                }
            }

            isOffscreen() {
                return this.x < -20 || this.x > canvas.width + 20 ||
                       this.y < -20 || this.y > canvas.height + 20;
            }

            draw() {
                ctx.beginPath();
                ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
                if (this.hue === 160) {
                    ctx.fillStyle = `rgba(16, 185, 129, ${this.currentOpacity})`; // emerald
                } else {
                    ctx.fillStyle = `rgba(124, 194, 74, ${this.currentOpacity})`; // lime
                }
                ctx.fill();
            }
        }

        // Spawn particles
        const particleCount = Math.min(120, Math.floor(window.innerWidth / 12));
        for (let i = 0; i < particleCount; i++) {
            const p = new Particle();
            p.life = Math.random() * p.maxLife; // stagger start
            particles.push(p);
        }

        // Speed lines
        class SpeedLine {
            constructor() { this.reset(); }

            reset() {
                this.x = Math.random() * canvas.width;
                this.y = Math.random() * canvas.height;
                this.length = Math.random() * 60 + 20;
                this.speed = Math.random() * 4 + 2;
                this.opacity = Math.random() * 0.06 + 0.02;
                this.angle = -0.2 + Math.random() * 0.4; // mostly horizontal
            }

            update() {
                this.x += Math.cos(this.angle) * this.speed;
                if (this.x > canvas.width + this.length) {
                    this.reset();
                    this.x = -this.length;
                }
            }

            draw() {
                ctx.beginPath();
                ctx.moveTo(this.x, this.y);
                ctx.lineTo(this.x + this.length * Math.cos(this.angle),
                           this.y + this.length * Math.sin(this.angle));
                ctx.strokeStyle = `rgba(255, 255, 255, ${this.opacity})`;
                ctx.lineWidth = 1;
                ctx.stroke();
            }
        }

        const lineCount = Math.min(30, Math.floor(window.innerWidth / 50));
        const speedLines = [];
        for (let i = 0; i < lineCount; i++) {
            speedLines.push(new SpeedLine());
        }

        function animate() {
            ctx.clearRect(0, 0, canvas.width, canvas.height);

            for (const line of speedLines) {
                line.update();
                line.draw();
            }

            for (const p of particles) {
                p.update();
                p.draw();
            }

            animFrame = requestAnimationFrame(animate);
        }
        animate();

        // Pause when not visible
        document.addEventListener('visibilitychange', () => {
            if (document.hidden) {
                cancelAnimationFrame(animFrame);
            } else {
                animate();
            }
        });
    }


    // ===== SCROLL ANIMATIONS (Intersection Observer) =====
    const animatedEls = document.querySelectorAll('.animate-in');
    if (animatedEls.length) {
        const observer = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    entry.target.classList.add('visible');
                    observer.unobserve(entry.target);
                }
            });
        }, { threshold: 0.1, rootMargin: '0px 0px -40px 0px' });

        animatedEls.forEach(el => observer.observe(el));
    }


    // ===== NAVBAR SCROLL =====
    const navbar = document.getElementById('navbar');
    let lastScroll = 0;

    window.addEventListener('scroll', () => {
        const scrollY = window.scrollY;
        if (scrollY > 50) {
            navbar.classList.add('scrolled');
        } else {
            navbar.classList.remove('scrolled');
        }
        lastScroll = scrollY;
    }, { passive: true });


    // ===== MOBILE MENU =====
    const mobileToggle = document.getElementById('mobile-toggle');
    const navLinks = document.getElementById('nav-links');

    if (mobileToggle && navLinks) {
        mobileToggle.addEventListener('click', () => {
            mobileToggle.classList.toggle('active');
            navLinks.classList.toggle('active');
            document.body.style.overflow = navLinks.classList.contains('active') ? 'hidden' : '';
        });

        navLinks.querySelectorAll('a').forEach(link => {
            link.addEventListener('click', () => {
                mobileToggle.classList.remove('active');
                navLinks.classList.remove('active');
                document.body.style.overflow = '';
            });
        });
    }


    // ===== COUNTER ANIMATIONS =====
    const counters = document.querySelectorAll('.stat-number[data-target]');
    if (counters.length) {
        const counterObserver = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    animateCounter(entry.target);
                    counterObserver.unobserve(entry.target);
                }
            });
        }, { threshold: 0.5 });

        counters.forEach(c => counterObserver.observe(c));
    }

    function animateCounter(el) {
        const target = parseFloat(el.dataset.target);
        const suffix = el.dataset.suffix || '';
        const prefix = el.dataset.prefix || '';
        const isRaw = el.dataset.raw === 'true';
        const decimal = parseInt(el.dataset.decimal) || 0;
        const duration = 2000;
        const start = performance.now();

        function tick(now) {
            const elapsed = now - start;
            const progress = Math.min(elapsed / duration, 1);
            // Ease out cubic
            const eased = 1 - Math.pow(1 - progress, 3);
            const current = eased * target;

            if (isRaw) {
                // For values like "$4.99" — animate the integer part, append suffix
                el.textContent = prefix + Math.floor(current) + suffix;
            } else if (target >= 1000) {
                el.textContent = prefix + Math.floor(current).toLocaleString() + suffix;
            } else if (decimal > 0) {
                el.textContent = prefix + current.toFixed(decimal) + suffix;
            } else {
                el.textContent = prefix + Math.floor(current) + suffix;
            }

            if (progress < 1) {
                requestAnimationFrame(tick);
            }
        }
        requestAnimationFrame(tick);
    }


    // ===== METRIC BAR ANIMATIONS =====
    const metricFills = document.querySelectorAll('.metric-fill[data-width]');
    if (metricFills.length) {
        const metricObserver = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    const el = entry.target;
                    el.style.setProperty('--target-width', el.dataset.width + '%');
                    el.classList.add('animated');
                    metricObserver.unobserve(el);
                }
            });
        }, { threshold: 0.3 });

        metricFills.forEach(el => metricObserver.observe(el));
    }


    // ===== MAGNETIC BUTTON EFFECT =====
    const magneticBtns = document.querySelectorAll('.magnetic-btn');

    magneticBtns.forEach(btn => {
        btn.addEventListener('mousemove', (e) => {
            const rect = btn.getBoundingClientRect();
            const x = e.clientX - rect.left - rect.width / 2;
            const y = e.clientY - rect.top - rect.height / 2;

            btn.style.transform = `translate(${x * 0.15}px, ${y * 0.15}px)`;
        });

        btn.addEventListener('mouseleave', () => {
            btn.style.transform = '';
            btn.style.transition = 'transform 0.4s cubic-bezier(0.4, 0, 0.2, 1)';
            setTimeout(() => { btn.style.transition = ''; }, 400);
        });
    });


    // ===== SMOOTH SCROLL FOR ANCHOR LINKS =====
    document.querySelectorAll('a[href^="#"]').forEach(anchor => {
        anchor.addEventListener('click', (e) => {
            const target = document.querySelector(anchor.getAttribute('href'));
            if (target) {
                e.preventDefault();
                const offset = parseInt(getComputedStyle(document.documentElement).getPropertyValue('--nav-height')) || 72;
                const top = target.getBoundingClientRect().top + window.scrollY - offset;
                window.scrollTo({ top, behavior: 'smooth' });
            }
        });
    });


    // ===== 3D TILT ON FEATURE CARDS =====
    const featureCards = document.querySelectorAll('.feature-card');

    featureCards.forEach(card => {
        card.addEventListener('mousemove', (e) => {
            const rect = card.getBoundingClientRect();
            const x = (e.clientX - rect.left) / rect.width - 0.5;
            const y = (e.clientY - rect.top) / rect.height - 0.5;

            card.style.transform = `translateY(-4px) perspective(600px) rotateX(${y * -5}deg) rotateY(${x * 5}deg)`;
        });

        card.addEventListener('mouseleave', () => {
            card.style.transform = '';
            card.style.transition = 'all 0.4s cubic-bezier(0.4, 0, 0.2, 1)';
            setTimeout(() => { card.style.transition = ''; }, 400);
        });
    });


    // ===== FAQ ACCORDION ANIMATION =====
    document.querySelectorAll('.faq-item').forEach(item => {
        item.addEventListener('toggle', () => {
            if (item.open) {
                const answer = item.querySelector('.faq-answer');
                answer.style.maxHeight = '0';
                answer.style.opacity = '0';
                answer.style.overflow = 'hidden';
                answer.style.transition = 'max-height 0.3s ease, opacity 0.3s ease';
                requestAnimationFrame(() => {
                    answer.style.maxHeight = answer.scrollHeight + 'px';
                    answer.style.opacity = '1';
                });
            }
        });
    });

});

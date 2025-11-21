document.addEventListener('DOMContentLoaded', () => {
  const ctaBar = document.getElementById('cta-bar');
  const hamburger = document.getElementById('floating-hamburger');
  const hamburgerMenu = document.getElementById('hamburger-menu');
  const closeMenuBtn = document.getElementById('close-menu');

  // 初期状態ではCTAバー非表示
  if (ctaBar) {
    ctaBar.classList.add('hidden');
  }

  // スクロールでCTAバーを表示
  window.addEventListener('scroll', () => {
    const scrollY = window.scrollY;

    if (scrollY > 0) {
      ctaBar?.classList.remove('hidden');
    } else {
      ctaBar?.classList.add('hidden');
      hamburgerMenu?.classList.remove('show'); // スクロールでメニューを閉じる
    }
  });

  // ハンバーガーメニューの表示切り替え
  if (hamburger && hamburgerMenu) {
    hamburger.addEventListener('click', () => {
      hamburgerMenu.classList.toggle('show');
    });
  }

  // 閉じるボタンでもメニューを閉じる
  if (closeMenuBtn && hamburgerMenu) {
    closeMenuBtn.addEventListener('click', () => {
      hamburgerMenu.classList.remove('show');
    });
  }

  //イベントセクションボタン

  const toggleBtn = document.getElementById('toggle-details');
  const detailsSection = document.getElementById('event-details');
  const closeBtn = detailsSection?.querySelector('.close-details');

  if (toggleBtn && detailsSection && closeBtn) {
    toggleBtn.addEventListener('click', () => {
      detailsSection.classList.add('show');
      detailsSection.classList.remove('hidden');
    });

    closeBtn.addEventListener('click', () => {
      detailsSection.classList.remove('show');
      setTimeout(() => {
        detailsSection.classList.add('hidden');
      }, 500);
    });
  }

    // 講師紹介スライダーの左右ナビゲーション
    const slider = document.getElementById('slider');
    const prevBtn = document.getElementById('prevBtn');
    const nextBtn = document.getElementById('nextBtn');
  
    if (slider && prevBtn && nextBtn) {
      prevBtn.addEventListener('click', () => {
        slider.scrollBy({ left: -300, behavior: 'smooth' });
      });
  
      nextBtn.addEventListener('click', () => {
        slider.scrollBy({ left: 300, behavior: 'smooth' });
      });
    }



});
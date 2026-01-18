import { apiInitializer } from "discourse/lib/api";
import ExternalLinkConfirm from "../components/modal/external-link-confirm";
import { i18n } from "discourse-i18n";

export default apiInitializer((api) => {
  const currentUser = api.container.lookup("service:current-user");
  const modal = api.container.lookup("service:modal");

  // 安全分割字符串，防止崩溃
  const safeSplit = (str) => (str || "").split("|").filter(Boolean);

  // 域名匹配
  const matchesDomain = (url, domainString) => {
    if (!url) return false;
    return safeSplit(domainString).some(d => url.includes(d.trim()));
  };

  // 内部链接判断
  const isInternal = (link) => {
    try {
      const href = link.getAttribute("href");
      if (!href || href.startsWith("/") || href.startsWith("#")) return true;
      if (link.href.includes(window.location.hostname)) return true;
      if (matchesDomain(link.href, settings.internal_domains)) return true;
    } catch(e) { return false; }
    return false;
  };

  // 打开弹窗
  const openModal = (e, url, level) => {
    e.preventDefault();
    e.stopPropagation();
    modal.show(ExternalLinkConfirm, {
      model: {
        url: url,
        securityLevel: level,
        openInNewTab: settings.external_links_in_new_tab
      }
    });
  };

  api.decorateCookedElement((element) => {
    if (!element) return;

    try {
      const links = element.querySelectorAll("a[href]");
      
      links.forEach(link => {
        // 排除特殊元素
        if (
          link.classList.contains("mention") || 
          link.classList.contains("lightbox") || 
          link.classList.contains("attachment") || 
          link.classList.contains("onebox")
        ) return;

        const url = link.href;

        // --- 优先级 1: 屏蔽域名 (Blocked) ---
        // 行为：直接替换为文本，无法查看原链接
        if (matchesDomain(url, settings.blocked_domains)) {
          const span = document.createElement("span");
          span.classList.add("blocked-link"); // CSS 添加 Ban 图标
          span.innerText = `[${i18n(themePrefix("secure_links.blocked_text"))}]`;
          span.title = url; // 鼠标悬停显示 URL (可选)
          link.replaceWith(span);
          return;
        }

        // --- 优先级 2: 内部域名 (Internal) ---
        if (isInternal(link)) return;

        // --- 优先级 3: 未登录 / 低等级拦截 ---
        // 这是前端防护的核心，必须在受信任判断之前或之后取决于策略
        // 这里策略是：即便是 Trusted 域名，未登录也看不了
        
        // 未登录拦截
        if (!currentUser && settings.enable_anonymous_blocking) {
          const loginLink = document.createElement("a");
          loginLink.href = settings.anonymous_redirect_url || "/login";
          loginLink.innerText = i18n(themePrefix("secure_links.login_to_view"));
          loginLink.classList.add("restricted-link-login");
          link.replaceWith(loginLink);
          return;
        }

        // TL0 拦截
        if (currentUser && currentUser.trust_level === 0 && settings.enable_tl0_blocking) {
          const tlLink = document.createElement("a");
          tlLink.href = settings.tl0_redirect_url || "#";
          tlLink.innerText = i18n(themePrefix("secure_links.first_trust_level_to_view"));
          tlLink.classList.add("restricted-link-tl0");
          link.replaceWith(tlLink);
          return;
        }

        // --- 优先级 4: 受信任域名 (Trusted) ---
        // 行为：显示绿锁，不弹窗
        if (matchesDomain(url, settings.excluded_domains)) {
          // 仅添加 CSS 类不做拦截
          // 我们在 common.scss 里通过 href 属性选择器加锁
          return; 
        }

        // --- 优先级 5: 风险/危险等级判定 ---
        let level = "normal";
        if (matchesDomain(url, settings.dangerous_domains)) {
          level = "dangerous";
        } else if (matchesDomain(url, settings.risky_domains)) {
          level = "risky";
        }

        // 给 DOM 加上标记，方便 CSS 画图标
        link.dataset.securityLevel = level;

        // --- 优先级 6: TL1 手动查看 (仅针对非 Trusted) ---
        if (currentUser && currentUser.trust_level === 1 && settings.enable_tl1_manual_reveal) {
          const button = document.createElement("a");
          button.href = "#";
          button.innerText = i18n(themePrefix("secure_links.click_to_view"));
          button.classList.add("secure-links-reveal");
          
          button.addEventListener("click", (e) => {
            e.preventDefault();
            e.stopPropagation();
            const realLink = document.createElement("a");
            realLink.href = url;
            realLink.innerHTML = link.innerHTML;
            realLink.dataset.securityLevel = level;
            // 恢复后的链接也要绑定弹窗
            realLink.addEventListener("click", (ev) => openModal(ev, url, level));
            button.replaceWith(realLink);
          });
          link.replaceWith(button);
          return;
        }

        // --- 优先级 7: 绑定弹窗 ---
        // 如果是普通外链且关闭了确认，则不处理
        if (level === "normal" && !settings.enable_exit_confirmation) return;

        link.addEventListener("click", (e) => openModal(e, url, level));
      });

    } catch (e) {
      console.error("[Link Shield] Error:", e);
    }
  }, { id: "secure-link-shield", onlyStream: true });
});

import { apiInitializer } from "discourse/lib/api";
import ExternalLinkConfirm from "../components/modal/external-link-confirm";
import { i18n } from "discourse-i18n";

export default apiInitializer((api) => {
  const currentUser = api.container.lookup("service:current-user");
  const modal = api.container.lookup("service:modal");

  // 辅助函数：匹配域名
  const matchesDomain = (url, domainString) => {
    if (!domainString || !url) return false;
    // 简单清洗 url，去掉 http/https
    const cleanUrl = url.replace(/^https?:\/\//, "");
    const domains = domainString.split("|").filter(d => d.trim());
    
    // 只要 URL 包含列表中的任意一个字符串，即视为匹配
    return domains.some(d => cleanUrl.includes(d.trim()));
  };

  // 辅助函数：判断是否为内部链接（基于 Discourse 自身逻辑 + 设置）
  const isInternal = (link) => {
    const url = link.href;
    // 1. 相对路径
    if (url.startsWith("/") || url.startsWith("#")) return true;
    // 2. 匹配当前站点域名
    if (url.includes(window.location.hostname)) return true;
    // 3. 匹配设置中的 Internal Domains
    if (matchesDomain(url, settings.internal_domains)) return true;
    
    return false;
  };

  api.decorateCookedElement((element) => {
      // 选取所有带 href 的 a 标签
      const links = element.querySelectorAll("a[href]");

      links.forEach((link) => {
        // 排除 Discourse 特殊元素
        if (
          link.classList.contains("mention") || 
          link.classList.contains("hashtag") || 
          link.classList.contains("lightbox") ||
          link.classList.contains("attachment")
        ) {
          return;
        }

        const url = link.href;

        // --- 优先级 1: Blocked (屏蔽) ---
        if (matchesDomain(url, settings.blocked_domains)) {
          const span = document.createElement("span");
          span.classList.add("blocked-link");
          span.innerText = `[${i18n(themePrefix("secure_links.blocked_text"))}]`;
          span.title = url; // 鼠标悬停显示原链接（可选）
          link.replaceWith(span);
          return; // 替换后直接结束
        }

        // --- 优先级 2: Internal (内部) ---
        if (isInternal(link)) {
          return; // 不做任何处理
        }

        // --- 优先级 3: Dangerous (危险) ---
        if (matchesDomain(url, settings.dangerous_domains)) {
          link.dataset.securityLevel = "dangerous";
        } 
        // --- 优先级 4: Risky (风险) ---
        else if (matchesDomain(url, settings.risky_domains)) {
          link.dataset.securityLevel = "risky";
        }
        // --- 优先级 5: Trusted (受信任) ---
        else if (matchesDomain(url, settings.excluded_domains)) {
          return; // 受信任域名直接放行，不绑定弹窗事件
        }
        // --- 优先级 6: Normal (普通) ---
        else {
          link.dataset.securityLevel = "normal";
        }

        // 如果全局开关关闭，且不是风险/危险链接，则不弹窗
        if (!settings.enable_exit_confirmation && link.dataset.securityLevel === "normal") {
          return;
        }

        // 绑定点击事件拦截
        link.addEventListener("click", (e) => {
          // 阻止默认跳转
          e.preventDefault();
          e.stopPropagation();
          
          modal.show(ExternalLinkConfirm, {
            model: {
              url: url,
              securityLevel: link.dataset.securityLevel || "normal",
              openInNewTab: settings.external_links_in_new_tab
            }
          });
        });
      });
    },
    { id: "secure-link-shield", onlyStream: true }
  );
});

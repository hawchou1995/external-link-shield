import Component from "@glimmer/component";
import { action } from "@ember/object";
import DModal from "discourse/components/d-modal";
import DButton from "discourse/components/d-button";
import dIcon from "discourse-common/helpers/d-icon";
import { i18n } from "discourse-i18n";
import { inject as service } from "@ember/service";

export default class ExternalLinkConfirm extends Component {
  @service toaster;

  get level() {
    return this.args.model.securityLevel;
  }

  get isDangerous() { return this.level === 'dangerous'; }
  get isRisky() { return this.level === 'risky'; }

  get title() {
    if (this.isDangerous) return i18n(themePrefix("secure_links.dangerous_title"));
    if (this.isRisky) return i18n(themePrefix("secure_links.risky_title"));
    return i18n(themePrefix("secure_links.leaving_confirmation_title"));
  }

  get titleIcon() {
    if (this.isDangerous) return "skull";
    if (this.isRisky) return "triangle-exclamation";
    return "external-link-alt";
  }

  // 计算警告图标的 CSS 类
  get iconClass() {
    if (this.isDangerous) return "danger-icon"; // 需在 CSS 定义颜色
    if (this.isRisky) return "warning-icon";
    return "normal-icon";
  }

  @action
  proceed() {
    const { url, openInNewTab } = this.args.model;
    if (openInNewTab) {
      window.open(url, "_blank", "noopener,noreferrer");
    } else {
      window.location.href = url;
    }
    this.args.closeModal();
  }

  @action
  copyUrl() {
    navigator.clipboard.writeText(this.args.model.url).then(() => {
       this.toaster.show(i18n(themePrefix("secure_links.copied")), { type: 'success' });
       // 复制后可以选择关闭弹窗
       // this.args.closeModal(); 
    });
  }

  <template>
    <DModal @title={{this.title}} @closeModal={{@closeModal}} class="external-link-modal {{this.level}}">
      <:body>
        <div class="d-modal-body-content">
          <div style="text-align: center; margin-bottom: 20px;">
            {{!-- 这里内联样式仅为示例，建议移入 CSS --}}
            {{dIcon this.titleIcon style=(if this.isDangerous "color: var(--danger); font-size: 3em;" (if this.isRisky "color: var(--yellow-600); font-size: 3em;" "color: var(--primary-medium); font-size: 3em;"))}}
          </div>

          <p style="font-size: 1.1em; text-align: center;">
            {{#if this.isDangerous}}
              {{i18n (themePrefix "secure_links.dangerous_warning")}}
            {{else if this.isRisky}}
              {{i18n (themePrefix "secure_links.risky_warning")}}
            {{else}}
              {{i18n (themePrefix "secure_links.leaving_confirmation_description_first")}}
            {{/if}}
          </p>

          <div style="background: var(--primary-low); padding: 10px; border-radius: 5px; word-break: break-all; margin: 15px 0; font-family: monospace;">
            {{@model.url}}
          </div>
        </div>
      </:body>

      <:footer>
        {{#if this.isDangerous}}
          <DButton
            @label={{themePrefix "secure_links.copy_url"}}
            @action={{this.copyUrl}}
            @icon="copy"
            class="btn-danger"
          />
        {{else}}
          <DButton
            @label={{themePrefix "secure_links.continue"}}
            @action={{this.proceed}}
            @icon="external-link-alt"
            class={{if this.isRisky "btn-warning" "btn-primary"}}
          />
        {{/if}}

        <DButton
          @label="cancel"
          @action={{@closeModal}}
          class="btn-flat"
        />
      </:footer>
    </DModal>
  </template>
}

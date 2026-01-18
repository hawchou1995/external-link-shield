import Component from "@glimmer/component";
import { action } from "@ember/object";
import DModal from "discourse/components/d-modal";
import DButton from "discourse/components/d-button";
import dIcon from "discourse-common/helpers/d-icon";
import { i18n } from "discourse-i18n";
import { inject as service } from "@ember/service";

export default class ExternalLinkConfirm extends Component {
  @service toaster;

  get level() { return this.args.model.securityLevel; }
  get isDangerous() { return this.level === 'dangerous'; }
  get isRisky() { return this.level === 'risky'; }
  get isNormal() { return !this.isDangerous && !this.isRisky; }

  get title() {
    if (this.isDangerous) return i18n(themePrefix("secure_links.dangerous_title"));
    if (this.isRisky) return i18n(themePrefix("secure_links.risky_title"));
    return i18n(themePrefix("secure_links.leaving_confirmation_title"));
  }

  get iconColor() {
     if (this.isDangerous) return "#FF3B30"; // Red
     if (this.isRisky) return "#FF9500";     // Orange
     return "#007AFF";                       // Blue
  }

  get titleIcon() {
    if (this.isDangerous) return "skull";
    if (this.isRisky) return "triangle-exclamation";
    return "external-link-alt";
  }

  get iconStyle() {
    // 缩小一点图标，让布局更紧凑
    return `font-size: 2.5em; color: ${this.iconColor};`;
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
    });
  }

  <template>
    <DModal @title={{this.title}} @closeModal={{@closeModal}} class="external-link-modal {{this.level}}">
      <:body>
        <div class="modal-body-container">
          
          {{!-- 1. 顶部图标 (缩小留白) --}}
          <div class="modal-icon-wrapper">
             {{dIcon this.titleIcon style=this.iconStyle}}
          </div>

          {{!-- 2. 普通外链的免责声明 (仅 Normal 显示) --}}
          {{#if this.isNormal}}
            <p class="disclaimer-text">
              {{i18n (themePrefix "secure_links.leaving_confirmation_disclaimer")}}
            </p>
          {{/if}}

          {{!-- 3. 核心提示文本 --}}
          <div class="main-alert-text">
            {{#if this.isDangerous}}
              {{i18n (themePrefix "secure_links.dangerous_warning")}}
            {{else if this.isRisky}}
              {{i18n (themePrefix "secure_links.risky_warning")}}
            {{else}}
               <span class="confirm-question">{{i18n (themePrefix "secure_links.leaving_confirmation_question")}}</span>
               <div class="redirect-hint">
                 {{i18n (themePrefix "secure_links.leaving_confirmation_destination")}}
                 {{dIcon "arrow-down"}}
               </div>
            {{/if}}
          </div>

          {{!-- 4. URL 胶囊 --}}
          <div class="url-preview">
            {{@model.url}}
          </div>

          {{!-- 5. 举报提示 (Normal/Risky 显示) --}}
          {{#if (not this.isDangerous)}}
            <div class="report-hint-box">
              {{dIcon "flag"}}
              <span>{{i18n (themePrefix "secure_links.leaving_confirmation_report_hint")}}</span>
            </div>
          {{/if}}

        </div>
      </:body>

      <:footer>
        <DButton
          @label="cancel"
          @action={{@closeModal}}
          class="btn-flat"
        />

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
            @icon="arrow-right"
            class={{if this.isRisky "btn-warning" "btn-primary"}}
          />
        {{/if}}
      </:footer>
    </DModal>
  </template>
}

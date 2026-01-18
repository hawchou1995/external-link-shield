import Component from "@glimmer/component";
import { action } from "@ember/object";
import DModal from "discourse/components/d-modal";
import DButton from "discourse/components/d-button";
import dIcon from "discourse-common/helpers/d-icon";
import { i18n } from "discourse-i18n";
import { inject as service } from "@ember/service";

export default class ExternalLinkConfirm extends Component {
  @service toaster;

  // --- 状态判断 ---
  get level() { return this.args.model.securityLevel; }
  get isDangerous() { return this.level === 'dangerous'; }
  get isRisky() { return this.level === 'risky'; }
  get isNormal() { return !this.isDangerous && !this.isRisky; }

  // --- 文本 Getters ---
  // 标题直接包含类型描述
  get title() {
    if (this.isDangerous) return i18n(themePrefix("secure_links.dangerous_title"));
    if (this.isRisky) return i18n(themePrefix("secure_links.risky_title"));
    return i18n(themePrefix("secure_links.leaving_confirmation_title"));
  }

  get disclaimerText() { return i18n(themePrefix("secure_links.leaving_confirmation_disclaimer")); }
  get questionText() { return i18n(themePrefix("secure_links.leaving_confirmation_question")); }
  get destinationText() { return i18n(themePrefix("secure_links.leaving_confirmation_destination")); }
  
  get dangerousWarningText() { return i18n(themePrefix("secure_links.dangerous_warning")); }
  get riskyWarningText() { return i18n(themePrefix("secure_links.risky_warning")); }
  
  get reportHintText() { return i18n(themePrefix("secure_links.leaving_confirmation_report_hint")); }
  
  get copyUrlLabel() { return i18n(themePrefix("secure_links.copy_url")); }
  get continueLabel() { return i18n(themePrefix("secure_links.continue")); }
  get cancelLabel() { return i18n("cancel"); }

  // --- 图标定义 ---
  get titleIcon() {
    if (this.isDangerous) return "skull";
    if (this.isRisky) return "triangle-exclamation";
    return "external-link-alt"; // 普通链接用这个图标
  }

  // --- 动作 ---
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
    {{!-- 
      1. @title="" : 隐藏 Discourse 默认标题栏 
      2. 增加 class="external-link-modal" 用于 CSS 定制
    --}}
    <DModal @title="" @closeModal={{@closeModal}} class="external-link-modal {{this.level}}">
      <:body>
        <div class="modal-body-container">
          
          {{!-- ✨ 自定义标题栏 (Icon + Text 一行显示) --}}
          <div class="custom-header {{this.level}}">
             {{dIcon this.titleIcon}}
             <span class="header-title">{{this.title}}</span>
          </div>

          {{!-- 分割线 --}}
          <div class="header-separator"></div>

          {{!-- 描述文本 --}}
          <div class="main-alert-text">
            {{!-- 危险/风险链接显示具体警告 --}}
            {{#if this.isDangerous}}
              <p class="warning-text dangerous">{{this.dangerousWarningText}}</p>
            {{else if this.isRisky}}
              <p class="warning-text risky">{{this.riskyWarningText}}</p>
            {{else}}
              {{!-- 普通链接显示常规提示 --}}
              <p class="disclaimer-text">{{this.disclaimerText}}</p>
              <p class="confirm-question">{{this.questionText}}</p>
            {{/if}}
          </div>

          {{!-- URL 预览胶囊 --}}
          <div class="url-preview">
            {{@model.url}}
          </div>

          {{!-- 举报提示 --}}
          {{#unless this.isDangerous}}
            <div class="report-hint-box">
              {{dIcon "flag"}}
              <span>{{this.reportHintText}}</span>
            </div>
          {{/unless}}

        </div>
      </:body>

      <:footer>
        <DButton
          @translatedLabel={{this.cancelLabel}} 
          @action={{@closeModal}}
          class="btn-flat"
        />

        {{#if this.isDangerous}}
          <DButton
            @translatedLabel={{this.copyUrlLabel}}
            @action={{this.copyUrl}}
            @icon="copy"
            class="btn-danger"
          />
        {{else}}
          <DButton
            @translatedLabel={{this.continueLabel}}
            @action={{this.proceed}}
            @icon="arrow-right"
            class={{if this.isRisky "btn-warning" "btn-primary"}}
          />
        {{/if}}
      </:footer>
    </DModal>
  </template>
}

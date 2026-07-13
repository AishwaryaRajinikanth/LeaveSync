import { Component, signal, ViewChild, ElementRef, AfterViewChecked, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ReconciliationService } from '../../../core/services/reconciliation.service';

interface ChatMsg { type: 'bot' | 'user'; text: string; typing?: boolean; }

@Component({
  selector: 'app-chat',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './chat.component.html',
  styleUrls: ['./chat.component.scss']
})
export class ChatComponent implements AfterViewChecked {
  @ViewChild('msgList') msgList!: ElementRef;

  open      = signal(false);
  input     = signal('');
  messages  = signal<ChatMsg[]>([
    { type: 'bot', text: "Hi! I'm the LeaveSync Assistant. I can help you with:\n• Leave balance inquiries\n• Reconciliation status\n• ITAS & E-Leave sync issues\n\nHow can I help you today?" }
  ]);
  suggestions = ['What is my leave balance?', 'Show reconciliation status', 'Any sync issues today?'];

  private recon = inject(ReconciliationService);

  ngAfterViewChecked() { this.scrollBottom(); }

  toggle() { this.open.update(v => !v); }

  send(text?: string) {
    const msg = (text ?? this.input()).trim();
    if (!msg) return;
    this.input.set('');
    this.messages.update(m => [...m, { type: 'user', text: msg }]);
    this.messages.update(m => [...m, { type: 'bot', text: '...', typing: true }]);

    setTimeout(() => {
      const reply = this.generateReply(msg);
      this.messages.update(m => [...m.slice(0, -1), { type: 'bot', text: reply }]);
    }, 800 + Math.random() * 600);
  }

  private generateReply(input: string): string {
    const l = input.toLowerCase();
    if (l.includes('balance') || l.includes('how many'))
      return 'Based on your records, you have 12 days Annual Leave, 8 days Sick Leave, and 3 days Emergency Leave remaining for 2026.';
    if (l.includes('reconcil') || l.includes('status'))
      return 'No reconciliation has been run yet. Upload your E-Leave and ITAS files, then click "Run Reconciliation" to check sync status.';
    if (l.includes('sync') || l.includes('issue') || l.includes('mismatch'))
      return 'Run a reconciliation to check for mismatches between E-Leave and ITAS.';
    if (l.includes('hello') || l.includes('hi') || l.includes('hey'))
      return 'Hello! How can I assist you with leave reconciliation today?';
    if (l.includes('help'))
      return 'I can help with: leave balance queries, reconciliation status, sync issue reports, and navigation of LeaveSync. Just ask!';
    if (l.includes('thank'))
      return "You're welcome! Let me know if there's anything else I can help with.";
    return "I can help with leave balances, reconciliation status, and sync issues. Try asking \"What's my leave balance?\" or \"Show reconciliation status\".";
  }

  private scrollBottom() {
    if (this.msgList?.nativeElement) {
      const el = this.msgList.nativeElement;
      el.scrollTop = el.scrollHeight;
    }
  }
}

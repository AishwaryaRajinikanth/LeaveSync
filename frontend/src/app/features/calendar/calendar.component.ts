import { Component, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { NotificationService } from '../../core/services/notification.service';

interface LeaveChip { name: string; cat: 'annual' | 'sick' | 'emergency' | 'unpaid'; }

@Component({
  selector: 'app-calendar',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './calendar.component.html',
  styleUrls: ['./calendar.component.scss']
})
export class CalendarComponent {
  title = 'July 2026';
  subtitle = 'Department leave view for July 2026';

  days: Array<{ day: number; isWeekend: boolean; isToday: boolean; leaves: LeaveChip[] }> = [];
  headers = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
  emptyStart = 3; // July 2026 starts on Wednesday (index 3)

  // Ported from app.js renderLeaveCalendar()
  private leaveData: Record<number, LeaveChip[]> = {
    1:  [{ name: 'Alice J.',   cat: 'annual' }],
    3:  [{ name: 'Bob M.',     cat: 'sick' }],
    7:  [{ name: 'Carol D.',   cat: 'annual' }, { name: 'David L.', cat: 'sick' }],
    10: [{ name: 'Emma W.',    cat: 'unpaid' }],
    14: [{ name: 'Frank B.',   cat: 'annual' }],
    17: [{ name: 'Grace K.',   cat: 'emergency' }],
    21: [{ name: 'Henry C.',   cat: 'sick' }],
    24: [{ name: 'Irene T.',   cat: 'annual' }, { name: 'James W.', cat: 'annual' }],
    28: [{ name: 'Karen H.',   cat: 'unpaid' }],
  };

  constructor(private notify: NotificationService) { this.buildDays(); }

  buildDays() {
    this.days = Array.from({ length: 31 }, (_, i) => {
      const day = i + 1;
      const dow = (3 + i) % 7;
      return {
        day,
        isWeekend: dow === 0 || dow === 6,
        isToday:   day === 11,
        leaves:    this.leaveData[day] || []
      };
    });
  }

  initials(name: string): string {
    return name.split(/\s+/).map(p => p[0]).join('').slice(0, 2).toUpperCase();
  }

  onDayClick(day: number) {
    this.notify.showToast(`July ${day}, 2026 selected`);
  }
}

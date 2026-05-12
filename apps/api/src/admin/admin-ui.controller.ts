import { Controller, Get, UseGuards } from '@nestjs/common';
import { AdminService } from '../services/admin.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { AdminRoleGuard } from './admin-role.guard';

@Controller('admin/panel')
export class AdminUiController {
  constructor(private readonly adminService: AdminService) {}

  @Get()
  async getDashboard() {
    const rankings = await this.adminService.getReferralRanking();
    
    return `
      <!DOCTYPE html>
      <html lang="en">
      <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>TripSave - Referral Leaderboard</title>
          <link href="https://fonts.googleapis.com/css2?family=Outfit:wght@400;600;800&display=swap" rel="stylesheet">
          <style>
              :root {
                  --primary: #19409B;
                  --secondary: #EFF6FF;
                  --text-dark: #111827;
                  --text-light: #6B7280;
                  --gold: #F59E0B;
                  --silver: #94A3B8;
                  --bronze: #B45309;
              }
              body {
                  font-family: 'Outfit', sans-serif;
                  background-color: #F8FAFC;
                  color: var(--text-dark);
                  margin: 0;
                  padding: 40px 20px;
              }
              .container {
                  max-width: 800px;
                  margin: 0 auto;
                  background: white;
                  padding: 40px;
                  border-radius: 24px;
                  box-shadow: 0 10px 40px rgba(0,0,0,0.04);
              }
              h1 {
                  font-weight: 800;
                  font-size: 32px;
                  margin-bottom: 8px;
                  color: var(--text-dark);
              }
              p.subtitle {
                  color: var(--text-light);
                  margin-bottom: 40px;
                  font-size: 16px;
              }
              table {
                  width: 100%;
                  border-collapse: collapse;
              }
              th {
                  text-align: left;
                  padding: 16px;
                  color: var(--text-light);
                  font-weight: 600;
                  text-transform: uppercase;
                  font-size: 12px;
                  letter-spacing: 0.05em;
                  border-bottom: 2px solid #F1F5F9;
              }
              td {
                  padding: 20px 16px;
                  border-bottom: 1px solid #F1F5F9;
                  font-weight: 600;
              }
              .rank {
                  width: 40px;
                  height: 40px;
                  display: flex;
                  align-items: center;
                  justify-content: center;
                  border-radius: 12px;
                  font-weight: 800;
                  background: var(--secondary);
                  color: var(--primary);
              }
              .rank-1 { background: #FEF3C7; color: var(--gold); }
              .rank-2 { background: #F1F5F9; color: var(--silver); }
              .rank-3 { background: #FFEDD5; color: var(--bronze); }
              
              .count {
                  background: var(--primary);
                  color: white;
                  padding: 6px 12px;
                  border-radius: 20px;
                  font-size: 14px;
                  font-weight: 800;
              }
              .name {
                  font-size: 18px;
                  color: var(--text-dark);
              }
          </style>
      </head>
      <body>
          <div class="container">
              <h1>Referral Leaderboard</h1>
              <p class="subtitle">Ranking of top referrers by count.</p>
              
              <table>
                  <thead>
                      <tr>
                          <th style="width: 80px;">Rank</th>
                          <th>Referrer Name</th>
                          <th style="text-align: right;">Count</th>
                      </tr>
                  </thead>
                  <tbody>
                      ${rankings.map((r, i) => `
                          <tr>
                              <td>
                                  <div class="rank ${i < 3 ? 'rank-' + (i + 1) : ''}">
                                      ${i + 1}
                                  </div>
                              </td>
                              <td class="name">${r.name}</td>
                              <td style="text-align: right;">
                                  <span class="count">${r.count}</span>
                              </td>
                          </tr>
                      `).join('')}
                      ${rankings.length === 0 ? '<tr><td colspan="3" style="text-align:center; padding: 40px; color: var(--text-light);">No referrals yet.</td></tr>' : ''}
                  </tbody>
              </table>
          </div>
      </body>
      </html>
    `;
  }
}

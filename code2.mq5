//+------------------------------------------------------------------+
//|                 ScalpingFixed_Follow50_100.mq5                   |
//|  Versi: 1.0 - SL+ awal 50 pts, follow from 100 pts at 10 pts gap |
//+------------------------------------------------------------------+
#property copyright "user"
#property link      "https://www.mql5.com"
#property version   "1.00"
#property strict

// -------------------- INPUTS --------------------
input int    FastEMAPeriod     = 9;
input int    SlowEMAPeriod     = 21;
input int    RSIPeriod         = 14;
input double RSIThreshold      = 50.0;

input double BaseLot           = 0.01;
input double MaxLot            = 1.0;
input int    Slippage          = 10;
input ulong  MagicNumber       = 123456;

input bool   UseWorkHours      = false;
input int    WorkStartHour     = 6;
input int    WorkEndHour       = 22;

input double MaxDrawdownPercent = 20.0;

// price/points rules (the ones you requested)
input int    InitialSLPoints   = 50;   // pertama: pindahkan SL ke entry +/- 50 points ketika profit >= 50
input int    FollowEnablePoints = 100;  // ketika profit >= 100 -> aktif follow-mode
input int    FollowDistancePts  = 10;   // jarak SL dari market ketika follow active (points)
input int    MinMoveToUpdateSL  = 1;    // minimal move (points) agar update SL dikirim

// safety
input int    StopsSafetyBuffer  = 1;    // minimal tambahan terhadap stops_level
input double MaxSpreadPoints    = 2000; // jika spread terlalu besar, jangan buka posisi

input bool TestMode = true;

// -------------------- GLOBALS --------------------
int handleFastEMA = INVALID_HANDLE;
int handleSlowEMA = INVALID_HANDLE;
int handleRSI     = INVALID_HANDLE;

double fastEMA_1=0, fastEMA_2=0;
double slowEMA_1=0, slowEMA_2=0;
double rsi_1=0;

datetime lastSLFailTime = 0;

// -------------------- INIT/DEINIT --------------------
int OnInit()
{
   Print("EA Follow50_100: OnInit");
   handleFastEMA = iMA(_Symbol, PERIOD_CURRENT, FastEMAPeriod, 0, MODE_EMA, PRICE_CLOSE);
   handleSlowEMA = iMA(_Symbol, PERIOD_CURRENT, SlowEMAPeriod, 0, MODE_EMA, PRICE_CLOSE);
   handleRSI     = iRSI(_Symbol, PERIOD_CURRENT, RSIPeriod, PRICE_CLOSE);

   if(handleFastEMA==INVALID_HANDLE || handleSlowEMA==INVALID_HANDLE || handleRSI==INVALID_HANDLE)
   {
      Print("EA Follow50_100: Failed to create indicator handles");
      return(INIT_FAILED);
   }

   PrintFormat("OnInit: symbol=%s point=%f digits=%d", _Symbol, _Point, (int)SymbolInfoInteger(_Symbol, SYMBOL_DIGITS));
   return(INIT_SUCCEEDED);
}

void OnDeinit(const int reason)
{
   if(handleFastEMA!=INVALID_HANDLE) IndicatorRelease(handleFastEMA);
   if(handleSlowEMA!=INVALID_HANDLE) IndicatorRelease(handleSlowEMA);
   if(handleRSI!=INVALID_HANDLE) IndicatorRelease(handleRSI);
}

// -------------------- INDICATOR READ --------------------
bool ReadIndicators()
{
   double fastBuf[2], slowBuf[2], rsiBuf[2];
   if(CopyBuffer(handleFastEMA,0,0,2,fastBuf) != 2) return false;
   if(CopyBuffer(handleSlowEMA,0,0,2,slowBuf) != 2) return false;
   if(CopyBuffer(handleRSI,0,0,2,rsiBuf) != 2) return false;

   fastEMA_1 = fastBuf[0]; fastEMA_2 = fastBuf[1];
   slowEMA_1 = slowBuf[0]; slowEMA_2 = slowBuf[1];
   rsi_1     = rsiBuf[0];
   return true;
}

// -------------------- HELPERS --------------------
bool IsWithinWorkHours()
{
   if(!UseWorkHours) return true;
   MqlDateTime dt; TimeToStruct(TimeCurrent(), dt);
   int h = dt.hour;
   if(WorkStartHour <= WorkEndHour) return (h >= WorkStartHour && h <= WorkEndHour);
   else return (h >= WorkStartHour || h <= WorkEndHour);
}

bool CheckRisk()
{
   double balance = AccountInfoDouble(ACCOUNT_BALANCE);
   double equity  = AccountInfoDouble(ACCOUNT_EQUITY);
   if(balance <= 0.0) return false;
   double drawdownPercent = (balance - equity) / balance * 100.0;
   if(drawdownPercent >= MaxDrawdownPercent)
   {
      PrintFormat("CheckRisk: drawdown %.2f%% >= limit %.2f%% -> skip", drawdownPercent, MaxDrawdownPercent);
      return false;
   }
   return true;
}

double NormalizeLotStep(double lot)
{
   double step = SymbolInfoDouble(_Symbol, SYMBOL_VOLUME_STEP);
   double minlot = SymbolInfoDouble(_Symbol, SYMBOL_VOLUME_MIN);
   if(step > 0.0) lot = MathFloor(lot/step) * step;
   if(lot < minlot) lot = minlot;
   return NormalizeDouble(lot, (int)SymbolInfoInteger(_Symbol, SYMBOL_VOLUME_DIGITS));
}

// count our positions for this symbol+magic
int CountOurPositions()
{
   int cnt = 0;
   int total = PositionsTotal();
   for(int i=0;i<total;i++)
   {
      ulong ticket = PositionGetTicket(i);
      if(ticket==0) continue;
      if(PositionSelectByTicket(ticket))
      {
         if((ulong)PositionGetInteger(POSITION_MAGIC) == MagicNumber && StringCompare(PositionGetString(POSITION_SYMBOL), _Symbol) == 0)
            cnt++;
      }
   }
   return cnt;
}

// get first position info (we assume only one cluster)
bool GetFirstPosition(ulong &ticket_out, long &type_out, double &vol_out, double &entry_out, double &curSL_out, double &profitPoints_out)
{
   ticket_out = 0;
   int total = PositionsTotal();
   for(int i=0;i<total;i++)
   {
      ulong ticket = PositionGetTicket(i);
      if(ticket==0) continue;
      if(PositionSelectByTicket(ticket))
      {
         if((ulong)PositionGetInteger(POSITION_MAGIC) == MagicNumber && StringCompare(PositionGetString(POSITION_SYMBOL), _Symbol) == 0)
         {
            ticket_out = ticket;
            type_out = (long)PositionGetInteger(POSITION_TYPE);
            vol_out = PositionGetDouble(POSITION_VOLUME);
            entry_out = PositionGetDouble(POSITION_PRICE_OPEN);
            curSL_out = PositionGetDouble(POSITION_SL);
            double bid = SymbolInfoDouble(_Symbol, SYMBOL_BID);
            double ask = SymbolInfoDouble(_Symbol, SYMBOL_ASK);
            if(type_out == POSITION_TYPE_BUY) profitPoints_out = (bid - entry_out) / _Point;
            else profitPoints_out = (entry_out - ask) / _Point;
            return true;
         }
      }
   }
   return false;
}

// -------------------- ORDER EXECUTION --------------------
bool PlaceMarketOrder(int type, double lot, int slPoints, int tpPoints)
{
   if(!CheckRisk()) return false;
   MqlTradeRequest req; MqlTradeResult res;
   ZeroMemory(req); ZeroMemory(res);

   int digits = (int)SymbolInfoInteger(_Symbol, SYMBOL_DIGITS);
   if(type == ORDER_TYPE_BUY)
   {
      req.action = TRADE_ACTION_DEAL;
      req.type   = ORDER_TYPE_BUY;
      req.price  = SymbolInfoDouble(_Symbol, SYMBOL_ASK);
      req.sl     = NormalizeDouble(req.price - slPoints * _Point, digits);
      req.tp     = NormalizeDouble(req.price + tpPoints * _Point, digits);
   }
   else if(type == ORDER_TYPE_SELL)
   {
      req.action = TRADE_ACTION_DEAL;
      req.type   = ORDER_TYPE_SELL;
      req.price  = SymbolInfoDouble(_Symbol, SYMBOL_BID);
      req.sl     = NormalizeDouble(req.price + slPoints * _Point, digits);
      req.tp     = NormalizeDouble(req.price - tpPoints * _Point, digits);
   }
   else return false;

   req.symbol = _Symbol;
   req.volume = lot;
   req.deviation = Slippage;
   req.magic = MagicNumber;
   req.comment = "Follow50_100";

   bool sent = OrderSend(req, res);
   if(!sent)
   {
      PrintFormat("PlaceMarketOrder: OrderSend failed err=%d", GetLastError());
      return false;
   }
   if(res.retcode != TRADE_RETCODE_DONE)
   {
      PrintFormat("PlaceMarketOrder: retcode=%d comment=%s", (int)res.retcode, res.comment);
      return false;
   }
   PrintFormat("PlaceMarketOrder: opened type=%d vol=%.2f price=%.5f sl=%.5f tp=%.5f", req.type, lot, req.price, req.sl, req.tp);
   return true;
}

// -------------------- MANAGE OPEN POSITIONS (SL logic per request) --------------------
void ManageOpenPositions_FollowLogic()
{
   int total = PositionsTotal();
   if(total <= 0) return;

   double bid = SymbolInfoDouble(_Symbol, SYMBOL_BID);
   double ask = SymbolInfoDouble(_Symbol, SYMBOL_ASK);
   double spreadPoints = (ask - bid) / _Point;
   long stops_level = (long)SymbolInfoInteger(_Symbol, SYMBOL_TRADE_STOPS_LEVEL);
   double stops_level_pts = (stops_level > 0 ? (double)stops_level : 0.0);

   // We update every our position (only our-symbol+magic)
   for(int i=total-1;i>=0;i--)
   {
      ulong ticket = PositionGetTicket(i);
      if(ticket==0) continue;
      if(!PositionSelectByTicket(ticket)) continue;

      if((ulong)PositionGetInteger(POSITION_MAGIC) != MagicNumber) continue;
      if(StringCompare(PositionGetString(POSITION_SYMBOL), _Symbol) != 0) continue;

      long type = (long)PositionGetInteger(POSITION_TYPE);
      double entry = PositionGetDouble(POSITION_PRICE_OPEN);
      double curSL  = PositionGetDouble(POSITION_SL);
      double curTP  = PositionGetDouble(POSITION_TP);
      int digits = (int)SymbolInfoInteger(_Symbol, SYMBOL_DIGITS);

      double profitPts = 0.0;
      if(type == POSITION_TYPE_BUY) profitPts = (bid - entry) / _Point;
      else profitPts = (entry - ask) / _Point;

      // Debug print
      PrintFormat("FOLLOW LOGIC: pos=%I64u type=%s entry=%.5f curSL=%.5f profitPts=%.1f bid=%.5f ask=%.5f",
                  ticket, (type==POSITION_TYPE_BUY?"BUY":"SELL"), entry, curSL, profitPts, bid, ask);

      double desiredSL = curSL;
      bool willUpdate = false;

      // 1) If profit >= InitialSLPoints -> ensure SL moved to entry +/- InitialSLPoints
      if(profitPts >= InitialSLPoints)
      {
         if(type == POSITION_TYPE_BUY)
         {
            double candidate = NormalizeDouble(entry + InitialSLPoints * _Point, digits);
            // only set if no SL or candidate is better (higher) than current SL + margin
            if(curSL <= 0.0 || candidate > curSL + MinMoveToUpdateSL * _Point)
            {
               // check stops level safety: price -> SL distance must be >= stops_level
               if((bid - candidate) / _Point >= stops_level_pts)
               {
                  desiredSL = candidate;
                  willUpdate = true;
                  PrintFormat("FOLLOW: pos=%I64u set initial SL to entry+%dpts = %.5f", ticket, InitialSLPoints, desiredSL);
               }
               else PrintFormat("FOLLOW: pos=%I64u initialSL candidate too close to price (stops=%d)", ticket, (int)stops_level);
            }
         }
         else // SELL
         {
            double candidate = NormalizeDouble(entry - InitialSLPoints * _Point, digits);
            if(curSL <= 0.0 || candidate < curSL - MinMoveToUpdateSL * _Point)
            {
               if((candidate - ask) / _Point >= stops_level_pts)
               {
                  desiredSL = candidate;
                  willUpdate = true;
                  PrintFormat("FOLLOW: pos=%I64u set initial SL to entry-%dpts = %.5f", ticket, InitialSLPoints, desiredSL);
               }
               else PrintFormat("FOLLOW: pos=%I64u initialSL candidate too close to price (stops=%d)", ticket, (int)stops_level);
            }
         }
      }

      // 2) If profit >= FollowEnablePoints -> activate aggressive follow: keep SL at distance FollowDistancePts from market
      if(profitPts >= FollowEnablePoints)
      {
         if(type == POSITION_TYPE_BUY)
         {
            double candidate = NormalizeDouble(bid - FollowDistancePts * _Point, digits);
            // candidate must be higher than current SL to lock more profit
            if(curSL <= 0.0 || candidate > curSL + MinMoveToUpdateSL * _Point)
            {
               if((bid - candidate) / _Point >= stops_level_pts)
               {
                  desiredSL = candidate;
                  willUpdate = true;
                  PrintFormat("FOLLOW ACTIVE: pos=%I64u BUY candidate SL = bid - %dpts = %.5f", ticket, FollowDistancePts, desiredSL);
               }
               else PrintFormat("FOLLOW ACTIVE: pos=%I64u candidate too close to price (stops=%d)", ticket, (int)stops_level);
            }
         }
         else // SELL
         {
            double candidate = NormalizeDouble(ask + FollowDistancePts * _Point, digits);
            if(curSL <= 0.0 || candidate < curSL - MinMoveToUpdateSL * _Point)
            {
               if((candidate - ask) / _Point >= stops_level_pts)
               {
                  desiredSL = candidate;
                  willUpdate = true;
                  PrintFormat("FOLLOW ACTIVE: pos=%I64u SELL candidate SL = ask + %dpts = %.5f", ticket, FollowDistancePts, desiredSL);
               }
               else PrintFormat("FOLLOW ACTIVE: pos=%I64u candidate too close to price (stops=%d)", ticket, (int)stops_level);
            }
         }
      }

      // 3) If willUpdate -> send TRADE_ACTION_SLTP
      if(willUpdate && NormalizeDouble(desiredSL, digits) != NormalizeDouble(curSL, digits))
      {
         MqlTradeRequest req; MqlTradeResult res;
         ZeroMemory(req); ZeroMemory(res);
         req.action = TRADE_ACTION_SLTP;
         req.position = ticket;
         req.symbol = _Symbol;
         req.sl = desiredSL;
         req.tp = curTP;

         bool sent = OrderSend(req, res);
         if(!sent)
         {
            int err = GetLastError();
            lastSLFailTime = TimeCurrent();
            PrintFormat("FOLLOW: OrderSend(SLTP) sent=false pos=%I64u err=%d", ticket, err);
         }
         else
         {
            PrintFormat("FOLLOW: SLTP sent pos=%I64u retcode=%d comment=%s newSL=%.5f", ticket, (int)res.retcode, res.comment, desiredSL);
            if(res.retcode != TRADE_RETCODE_DONE)
            {
               lastSLFailTime = TimeCurrent();
               PrintFormat("FOLLOW: SLTP NOT done pos=%I64u retcode=%d comment=%s", ticket, (int)res.retcode, res.comment);
            }
            else lastSLFailTime = 0;
         }
      }
   } // end for
}

// -------------------- OnTick (simple flow: signal -> open -> manage) --------------------
void OnTick()
{
   // 1) update indicators (for signal)
   if(!ReadIndicators()) { Print("OnTick: ReadIndicators failed"); }

   // 2) manage open positions' SL according to rules
   ManageOpenPositions_FollowLogic();

   // 3) if we already have an open position for our symbol+magic, do not open new
   if(CountOurPositions() > 0) return;

   // 4) get a simple signal (TestMode: EMA simple)
   // Basic signal: fastEMA > slowEMA -> BUY, reverse -> SELL (TestMode relaxed)
   TradeSignal sig = NONE;
   if(TestMode)
   {
      if(fastEMA_1 > slowEMA_1 && rsi_1 > 40.0) sig = BUY;
      else if(fastEMA_1 < slowEMA_1 && rsi_1 < 60.0) sig = SELL;
   }
   else
   {
      bool bullishCross = (fastEMA_2 <= slowEMA_2) && (fastEMA_1 > slowEMA_1);
      bool bearishCross = (fastEMA_2 >= slowEMA_2) && (fastEMA_1 < slowEMA_1);
      if(bullishCross && rsi_1 > RSIThreshold) sig = BUY;
      if(bearishCross && rsi_1 < RSIThreshold) sig = SELL;
   }

   if(sig == NONE) return;
   if(!IsWithinWorkHours()) return;

   // check spread safety before opening
   double spreadPoints = (SymbolInfoDouble(_Symbol,SYMBOL_ASK) - SymbolInfoDouble(_Symbol,SYMBOL_BID)) / _Point;
   if(spreadPoints > MaxSpreadPoints) { PrintFormat("OnTick: spread too high %.1f -> skip", spreadPoints); return; }

   // calculate lot (use base only)
   double lot = NormalizeLotStep(BaseLot);
   if(lot > MaxLot) lot = MaxLot;

   // open order with initial SL/TP based on StopLossPoints/TakeProfitPoints
   int tpPoints = TakeProfitPoints; // we didn't define TakeProfitPoints above; define quick local fallback
   // define default TP if none provided
   tpPoints = 300; // safe default
   // open market order
   int orderType = (sig==BUY) ? ORDER_TYPE_BUY : ORDER_TYPE_SELL;
   PrintFormat("OnTick: opening new order signal=%s lot=%.2f", (sig==BUY?"BUY":"SELL"), lot);
   PlaceMarketOrder(orderType, lot, StopLossPoints, tpPoints);
}

// -------------------- ENUMS for signal -->
enum TradeSignal { NONE=0, BUY=1, SELL=2 };

// -------------------- OnTradeTransaction (debug) --------------------
void OnTradeTransaction(const MqlTradeTransaction &trans,const MqlTradeRequest &request,const MqlTradeResult &result)
{
   // debug only
   PrintFormat("OnTradeTransaction: type=%d order=%I64u result=%d", (int)trans.type, trans.order, (int)result.retcode);
}

//+------------------------------------------------------------------+
//|                                    ScalpingFixed_Combined_Full.mq5|
//|  Versi: 2.1 - Added evaluation delay when position is minus     |
//+------------------------------------------------------------------+
#property copyright "user"
#property link      "https://www.mql5.com"
#property version   "2.10"
#property strict

// -------------------- INPUTS --------------------
input int      FastEMAPeriod     = 9;
input int      SlowEMAPeriod     = 21;
input int      RSIPeriod         = 14;
input double   RSIThreshold      = 50.0;
input ENUM_APPLIED_VOLUME AppliedVolumeType = VOLUME_TICK;

input double   RiskPercent       = 1.0;
input int      StopLossPoints    = 150;
input int      TakeProfitPoints  = 300;
input double   MaxSpreadPoints   = 2000;
input int      WorkStartHour     = 6;
input int      WorkEndHour       = 22;
input ulong    MagicNumber       = 123456;
input int      Slippage          = 10;
input double   BaseLot           = 0.01;
input double   LotMultiplier     = 2.0;
input int      MaxConsecutiveMultiplier = 5;
input double   MaxLot            = 1.0;
input bool     UseWorkHours = false;
input double   MaxDrawdownPercent = 20.0;
input double   MaxLotAbsolute = 0.5;
input bool     TestMode = true;

// Trailing / BE / time-based close inputs
input int    TrailingStartPoints    = 100;
input int    TrailingStepPoints     = 20;
input int    BreakEvenBufferPoints  = 5;
input int    MaxHoldSeconds         = 3600;
input bool   CloseOnOppositeSignal  = true;

// Dynamic trailing inputs
input bool   UseDynamicTrailing     = true;
input int    TrailingDistancePoints = 30;
input int    TrailingMinMovePoints  = 3;

// Averaging / add-on trade inputs
input bool   AveragingEnabled       = true;
input int    AveragingTriggerPoints = 50;
input int    MaxAveragingTrades     = 3;
input double AveragingMultiplier    = 1.5;
input int    AveragingCooldownSeconds = 10;

// Increase lot after loss (pending for next NEW trade)
input double IncreaseAfterLossFactor = 2.0;
input int    LastLossCooldownSeconds = 3600;

// SL retry adaptive inputs
input int    SLRetryCooldownSeconds = 5;
input int    SLRetryIncreasePoints = 5;

// Follow-mode inputs (original from code1)
input int    FollowStartPips        = 0;
input int    FollowStartPoints      = 0;
input double FollowStartMoney       = 0.0;
input int    FollowDistancePoints   = 30;
input int    FollowMinMovePoints    = 1;
input double MinSLMoney             = 0.05;
input int    MinSLPointsFallback    = 10;

// NEW: Follow SL Rules (sesuai permintaan Anda) - PRIORITAS TERTINGGI
input bool   UseNewFollowLogic      = true;  // Aktifkan logika baru: 50pts->100pts->10pts
input int    SLPlusAt50Points       = 50;    // Ketika profit >= 50 pts, pindahkan SL ke entry + 50 pts
input int    FollowEnableAt100      = 100;   // Ketika profit >= 100 pts, aktifkan follow mode
input int    FollowGap10Points      = 10;    // Jarak SL dari market saat follow aktif (10 points)
input int    MinMoveToUpdateSL      = 1;     // Minimal move untuk update SL (points)

// NEW: Progressive Lot Settings (sesuai permintaan Anda)
input bool   UseProgressiveLot      = true;  // Aktifkan progressive lot (0.01->0.02->0.03)
input double LotIncrement           = 0.01;  // Increment lot setiap kali loss

// ✅ NEW: Entry Evaluation Settings (mencegah entry terlalu cepat saat minus)
input bool   UseEntryEvaluation     = true;  // ✅ Aktifkan evaluasi sebelum entry
input int    MinWaitAfterLossSeconds = 60;   // ✅ Minimal tunggu setelah close loss (detik)
input double MinProfitPointsToEntry = -20.0; // ✅ Minimal profit points untuk boleh entry baru (negatif = masih minus)
input int    EvaluationPeriodSeconds = 30;   // ✅ Periode evaluasi trend (detik)
input bool   RequireOppositeSignal  = false; // ✅ Butuh signal berlawanan untuk entry setelah loss

// -------------------- GLOBALS --------------------
int handleFastEMA = INVALID_HANDLE;
int handleSlowEMA = INVALID_HANDLE;
int handleRSI     = INVALID_HANDLE;
int handleOBV     = INVALID_HANDLE;

double fastEMA_1=0, fastEMA_2=0;
double slowEMA_1=0, slowEMA_2=0;
double rsi_1=0;
double obv_1=0, obv_2=0;

int consecutiveLosses = 0;
ulong lastHandledDealTicket = 0;

// track last losing lot
double lastLostLot = 0.0;
datetime lastLossTime = 0;

// track last averaging time
datetime lastAveragingTime = 0;

// pending next-lot
double pendingNextLot = 0.0;
bool pendingNextLotActive = false;
double pendingOriginLot = 0.0;

// last SL update failure
datetime lastSLFailTime = 0;

// NEW: Progressive lot tracking
double currentProgressiveLot = 0.0;

// ✅ NEW: Entry evaluation tracking
datetime lastPositionCloseTime = 0;
int lastClosedPositionType = -1;  // 0=BUY, 1=SELL, -1=none
bool lastPositionWasLoss = false;
double lastClosedPositionProfit = 0.0;

// -------------------- INIT / DEINIT --------------------
int OnInit()
{
   Print("ScalpingFixed v2.1: Entry Evaluation System - Prevent quick losses");
   
   handleFastEMA = iMA(_Symbol, PERIOD_CURRENT, FastEMAPeriod, 0, MODE_EMA, PRICE_CLOSE);
   handleSlowEMA = iMA(_Symbol, PERIOD_CURRENT, SlowEMAPeriod, 0, MODE_EMA, PRICE_CLOSE);
   handleRSI     = iRSI(_Symbol, PERIOD_CURRENT, RSIPeriod, PRICE_CLOSE);
   handleOBV     = iOBV(_Symbol, PERIOD_CURRENT, AppliedVolumeType);
   
   if(handleFastEMA==INVALID_HANDLE || handleSlowEMA==INVALID_HANDLE || 
      handleRSI==INVALID_HANDLE || handleOBV==INVALID_HANDLE)
   {
      Print("Failed to create indicator handles");
      return(INIT_FAILED);
   }

   double pointVal = _Point;
   long stops_level = (long)SymbolInfoInteger(_Symbol, SYMBOL_TRADE_STOPS_LEVEL);
   double minLot = SymbolInfoDouble(_Symbol, SYMBOL_VOLUME_MIN);
   double stepLot = SymbolInfoDouble(_Symbol, SYMBOL_VOLUME_STEP);
   
   PrintFormat("OnInit: sym=%s point=%f stops_level=%d minLot=%.2f stepLot=%.2f BaseLot=%.2f",
               _Symbol, pointVal, (int)stops_level, minLot, stepLot, BaseLot);
   
   if(UseEntryEvaluation)
   {
      PrintFormat("✅ Entry Evaluation ENABLED: MinWait=%ds MinProfitPts=%.1f EvalPeriod=%ds RequireOpposite=%s",
                  MinWaitAfterLossSeconds, MinProfitPointsToEntry, EvaluationPeriodSeconds, 
                  RequireOppositeSignal?"YES":"NO");
   }

   // Initialize progressive lot
   currentProgressiveLot = BaseLot;

   return(INIT_SUCCEEDED);
}

void OnDeinit(const int reason)
{
   if(handleFastEMA!=INVALID_HANDLE) IndicatorRelease(handleFastEMA);
   if(handleSlowEMA!=INVALID_HANDLE) IndicatorRelease(handleSlowEMA);
   if(handleRSI!=INVALID_HANDLE) IndicatorRelease(handleRSI);
   if(handleOBV!=INVALID_HANDLE) IndicatorRelease(handleOBV);
}

// -------------------- INDICATORS --------------------
bool ReadIndicators()
{
   double fastBuf[2], slowBuf[2], rsiBuf[2], obvBuf[2];
   if(CopyBuffer(handleFastEMA,0,0,2,fastBuf) != 2) return false;
   if(CopyBuffer(handleSlowEMA,0,0,2,slowBuf) != 2) return false;
   if(CopyBuffer(handleRSI,0,0,2,rsiBuf) != 2) return false;
   if(CopyBuffer(handleOBV,0,0,2,obvBuf) != 2) return false;

   fastEMA_1 = fastBuf[0];
   fastEMA_2 = fastBuf[1];
   slowEMA_1 = slowBuf[0];
   slowEMA_2 = slowBuf[1];
   rsi_1 = rsiBuf[0];
   obv_1 = obvBuf[0];
   obv_2 = obvBuf[1];

   return true;
}

// -------------------- HELPERS - RISK & LOT --------------------
bool IsWithinWorkHours(int startHour, int endHour)
{
   if(!UseWorkHours) return true;
   MqlDateTime dt;
   datetime current = TimeCurrent();
   TimeToStruct(current, dt);
   int h = dt.hour;
   if(startHour <= endHour) return (h >= startHour && h <= endHour);
   else return (h >= startHour || h <= endHour);
}

bool CheckRisk()
{
   double balance = AccountInfoDouble(ACCOUNT_BALANCE);
   double equity  = AccountInfoDouble(ACCOUNT_EQUITY);
   if(balance <= 0.0) return false;
   double drawdownPercent = (balance - equity) / balance * 100.0;
   if(drawdownPercent >= MaxDrawdownPercent)
   {
      PrintFormat("CheckRisk: drawdown limit reached: %.2f%% >= %.2f%%", drawdownPercent, MaxDrawdownPercent);
      return false;
   }
   return true;
}

double NormalizeLotStep(double lot)
{
   double step = SymbolInfoDouble(_Symbol, SYMBOL_VOLUME_STEP);
   double minlot = SymbolInfoDouble(_Symbol, SYMBOL_VOLUME_MIN);
   if(step > 0.0)
      lot = MathFloor(lot/step) * step;
   if(lot < minlot) lot = minlot;
   return NormalizeDouble(lot, 2);
}

double CalculateBaseLot()
{
   double lot = BaseLot;
   double minlot = SymbolInfoDouble(_Symbol, SYMBOL_VOLUME_MIN);
   if(lot < minlot) lot = minlot;
   return NormalizeLotStep(lot);
}

double CalculateLotWithMultiplier()
{
   double base = CalculateBaseLot();
   int multSteps = MathMin(consecutiveLosses, MaxConsecutiveMultiplier);
   double lot = base * MathPow(LotMultiplier, multSteps);

   bool useLastLost = false;
   if(lastLostLot > 0.0)
   {
      if(LastLossCooldownSeconds <= 0) useLastLost = true;
      else if(TimeCurrent() - lastLossTime <= (uint)LastLossCooldownSeconds) useLastLost = true;
   }
   if(useLastLost)
   {
      double required = lastLostLot * IncreaseAfterLossFactor;
      if(required > lot) lot = required;
   }

   if(lot > MaxLot) lot = MaxLot;
   if(lot > MaxLotAbsolute) lot = MaxLotAbsolute;
   return NormalizeLotStep(lot);
}

double CalculateAveragingLot(double currentVolume)
{
   double lot = currentVolume * AveragingMultiplier;

   bool useLastLost = false;
   if(lastLostLot > 0.0)
   {
      if(LastLossCooldownSeconds <= 0) useLastLost = true;
      else if(TimeCurrent() - lastLossTime <= (uint)LastLossCooldownSeconds) useLastLost = true;
   }
   if(useLastLost)
   {
      double required = lastLostLot * IncreaseAfterLossFactor;
      if(required > lot) lot = required;
   }

   if(lot > MaxLot) lot = MaxLot;
   if(lot > MaxLotAbsolute) lot = MaxLotAbsolute;
   return NormalizeLotStep(lot);
}

// -------------------- SIGNAL --------------------
enum TradeSignal { NONE=0, BUY=1, SELL=2 };

TradeSignal GetSignal()
{
   if(!ReadIndicators()) return NONE;

   double spreadPoints = (SymbolInfoDouble(_Symbol,SYMBOL_ASK) - SymbolInfoDouble(_Symbol,SYMBOL_BID)) / _Point;
   if(spreadPoints > MaxSpreadPoints) return NONE;
   if(!IsWithinWorkHours(WorkStartHour, WorkEndHour)) return NONE;

   bool bullishCross = (fastEMA_2 <= slowEMA_2) && (fastEMA_1 > slowEMA_1);
   bool bearishCross = (fastEMA_2 >= slowEMA_2) && (fastEMA_1 < slowEMA_1);
   bool obvConfirmBuy = obv_1 > obv_2;
   bool obvConfirmSell = obv_1 < obv_2;

   if(TestMode)
   {
      bool simpleBull = (fastEMA_1 > slowEMA_1);
      bool simpleBear = (fastEMA_1 < slowEMA_1);
      if(simpleBull && rsi_1 > 45.0) return BUY;
      if(simpleBear && rsi_1 < 55.0) return SELL;
      return NONE;
   }

   if(bullishCross && rsi_1 > RSIThreshold && obvConfirmBuy) return BUY;
   if(bearishCross && rsi_1 < RSIThreshold && obvConfirmSell) return SELL;
   return NONE;
}

// ✅ -------------------- ENTRY EVALUATION FUNCTION --------------------
bool CanOpenNewPosition(TradeSignal currentSignal)
{
   if(!UseEntryEvaluation) return true;
   
   // Jika tidak ada posisi yang pernah ditutup, boleh entry
   if(lastPositionCloseTime == 0) return true;
   
   datetime currentTime = TimeCurrent();
   int secondsSinceClose = (int)(currentTime - lastPositionCloseTime);
   
   // Rule 1: Tunggu minimal waktu setelah close loss
   if(lastPositionWasLoss && secondsSinceClose < MinWaitAfterLossSeconds)
   {
      PrintFormat("⏳ ENTRY BLOCKED: Waiting %d more seconds after LOSS (elapsed: %d/%d)",
                  MinWaitAfterLossSeconds - secondsSinceClose, secondsSinceClose, MinWaitAfterLossSeconds);
      return false;
   }
   
   // Rule 2: Cek apakah butuh signal berlawanan setelah loss
   if(lastPositionWasLoss && RequireOppositeSignal)
   {
      bool isOpposite = false;
      if(lastClosedPositionType == POSITION_TYPE_BUY && currentSignal == SELL) isOpposite = true;
      if(lastClosedPositionType == POSITION_TYPE_SELL && currentSignal == BUY) isOpposite = true;
      
      if(!isOpposite)
      {
         PrintFormat("🔄 ENTRY BLOCKED: Waiting for OPPOSITE signal (last was %s, need %s)",
                     (lastClosedPositionType==POSITION_TYPE_BUY?"BUY":"SELL"),
                     (lastClosedPositionType==POSITION_TYPE_BUY?"SELL":"BUY"));
         return false;
      }
      else
      {
         PrintFormat("✅ OPPOSITE signal detected! Entry allowed after LOSS");
      }
   }
   
   // Rule 3: Evaluasi trend dalam periode evaluasi
   if(lastPositionWasLoss && secondsSinceClose < EvaluationPeriodSeconds)
   {
      // Cek apakah trend sudah berubah (simple evaluation)
      bool trendChanged = false;
      if(lastClosedPositionType == POSITION_TYPE_BUY && fastEMA_1 < slowEMA_1) trendChanged = true;
      if(lastClosedPositionType == POSITION_TYPE_SELL && fastEMA_1 > slowEMA_1) trendChanged = true;
      
      if(!trendChanged)
      {
         PrintFormat("📊 ENTRY BLOCKED: Trend not changed yet (eval period: %d/%d sec)",
                     secondsSinceClose, EvaluationPeriodSeconds);
         return false;
      }
      else
      {
         PrintFormat("✅ Trend CHANGED detected! Entry allowed");
      }
   }
   
   // Rule 4: Cek profit minimal (untuk avoid entry saat market masih bergerak melawan)
   // Hanya berlaku jika ada posisi terbuka yang baru saja ditutup
   if(lastPositionWasLoss && lastClosedPositionProfit < MinProfitPointsToEntry)
   {
      PrintFormat("📉 ENTRY BLOCKED: Last closed profit too low (%.2f < %.2f points)",
                  lastClosedPositionProfit, MinProfitPointsToEntry);
      return false;
   }
   
   PrintFormat("✅ Entry EVALUATION PASSED - Can open new position");
   return true;
}

// -------------------- ORDER EXECUTION --------------------
bool ExecuteMarketOrder(TradeSignal signal,double lot,int slPoints,int tpPoints)
{
   if(!CheckRisk()) return false;

   MqlTradeRequest req;
   MqlTradeResult  res;
   ZeroMemory(req);
   ZeroMemory(res);
   double price=0, sl=0, tp=0;
   int digits = (int)SymbolInfoInteger(_Symbol,SYMBOL_DIGITS);
   if(signal==BUY)
   {
      price = SymbolInfoDouble(_Symbol,SYMBOL_ASK);
      sl = price - slPoints * _Point;
      tp = price + tpPoints * _Point;
      req.action = TRADE_ACTION_DEAL;
      req.type   = ORDER_TYPE_BUY;
   }
   else if(signal==SELL)
   {
      price = SymbolInfoDouble(_Symbol,SYMBOL_BID);
      sl = price + slPoints * _Point;
      tp = price - tpPoints * _Point;
      req.action = TRADE_ACTION_DEAL;
      req.type   = ORDER_TYPE_SELL;
   }
   else return false;

   req.symbol = _Symbol;
   req.volume = lot;
   req.price  = price;
   req.sl     = NormalizeDouble(sl,digits);
   req.tp     = NormalizeDouble(tp,digits);
   req.deviation = Slippage;
   req.magic = MagicNumber;
   req.comment = "ScalpingBot";
   bool sent = OrderSend(req,res);
   if(!sent)
   {
      PrintFormat("ExecuteMarketOrder: OrderSend failed, err=%d", GetLastError());
      return false;
   }
   if(res.retcode != TRADE_RETCODE_DONE)
   {
      PrintFormat("ExecuteMarketOrder: retcode=%d comment=%s", (int)res.retcode, res.comment);
      return false;
   }
   PrintFormat("ExecuteMarketOrder: opened %s vol=%.2f price=%.5f sl=%.5f tp=%.5f",
               (signal==BUY?"BUY":"SELL"), lot, price, req.sl, req.tp);
   return true;
}

// -------------------- HISTORY DEAL CHECK (handles pendingNextLot + Progressive Lot logic) --------------------
void CheckClosedDealsForLoss()
{
   if(!HistorySelect(0, TimeCurrent())) return;
   
   int deals = (int)HistoryDealsTotal();
   if(deals <= 0) return;
   ulong lastDealTicket = HistoryDealGetTicket(deals-1);
   if(lastDealTicket == 0) return;
   if(lastDealTicket == lastHandledDealTicket) return;

   double profit = HistoryDealGetDouble(lastDealTicket, DEAL_PROFIT);
   double vol = HistoryDealGetDouble(lastDealTicket, DEAL_VOLUME);
   long dealType = HistoryDealGetInteger(lastDealTicket, DEAL_TYPE);
   ulong order_ticket = HistoryDealGetInteger(lastDealTicket, DEAL_ORDER);
   bool belongsToUs = false;
   if(order_ticket != 0)
   {
      ulong ord_magic = HistoryOrderGetInteger(order_ticket, ORDER_MAGIC);
      if(ord_magic == MagicNumber) belongsToUs = true;
   }
   string deal_symbol = HistoryDealGetString(lastDealTicket, DEAL_SYMBOL);
   if(StringCompare(deal_symbol, _Symbol) != 0) belongsToUs = false;

   lastHandledDealTicket = lastDealTicket;

   if(!belongsToUs) return;

   // ✅ Track position close for evaluation
   if(dealType == DEAL_TYPE_BUY || dealType == DEAL_TYPE_SELL)
   {
      lastPositionCloseTime = TimeCurrent();
      lastClosedPositionType = (dealType == DEAL_TYPE_SELL) ? POSITION_TYPE_BUY : POSITION_TYPE_SELL;
      lastClosedPositionProfit = profit;
   }

   if(profit < 0.0)
   {
      // LOSS detected
      lastPositionWasLoss = true;
      consecutiveLosses++;
      lastLostLot = vol;
      lastLossTime = TimeCurrent();
      
      // OLD pendingNextLot logic
      double candidate = lastLostLot * IncreaseAfterLossFactor;
      candidate = NormalizeLotStep(candidate);
      if(candidate > MaxLot) candidate = MaxLot;
      if(candidate > MaxLotAbsolute) candidate = MaxLotAbsolute;
      pendingNextLot = candidate;
      pendingNextLotActive = true;
      pendingOriginLot = lastLostLot;
      
      // NEW: Progressive lot logic
      if(UseProgressiveLot)
      {
         currentProgressiveLot = vol + LotIncrement;
         currentProgressiveLot = NormalizeLotStep(currentProgressiveLot);
         if(currentProgressiveLot > MaxLot) currentProgressiveLot = MaxLot;
         if(currentProgressiveLot > MaxLotAbsolute) currentProgressiveLot = MaxLotAbsolute;
         
         PrintFormat("❌ LOSS! vol=%.2f profit=%.2f -> next lot=%.2f (progressive)", vol, profit, currentProgressiveLot);
      }
      
      PrintFormat("❌ LOST deal %I64u profit=%.2f vol=%.2f -> consecutiveLosses=%d", 
                  lastDealTicket, profit, vol, consecutiveLosses);
   }
   else
   {
      // PROFIT detected
      lastPositionWasLoss = false;
      
      PrintFormat("✅ PROFIT deal %I64u profit=%.2f vol=%.2f", lastDealTicket, profit, vol);
      
      if(pendingNextLotActive)
      {
         double step = SymbolInfoDouble(_Symbol, SYMBOL_VOLUME_STEP);
         double diff = MathAbs(vol - pendingNextLot);
         if(diff <= (step/2.0) || vol == pendingNextLot)
         {
            consecutiveLosses = 0;
            lastLostLot = 0.0;
            lastLossTime = 0;
            pendingNextLotActive = false;
            pendingNextLot = 0.0;
            pendingOriginLot = 0.0;
         }
      }
      else
      {
         consecutiveLosses = 0;
         lastLostLot = 0.0;
         lastLossTime = 0;
      }
      
      // NEW: Progressive lot reset on profit
      if(UseProgressiveLot)
      {
         currentProgressiveLot = BaseLot;
         currentProgressiveLot = NormalizeLotStep(currentProgressiveLot);
         PrintFormat("✅ PROFIT! Resetting to BaseLot=%.2f", currentProgressiveLot);
      }
   }
}

// -------------------- POSITIONS HELPERS --------------------
int CountOurPositions()
{
   int count = 0;
   int total = PositionsTotal();
   for(int i=0;i<total;i++)
   {
      ulong ticket = PositionGetTicket(i);
      if(ticket==0) continue;
      if(PositionSelectByTicket(ticket))
      {
         ulong pmagic = (ulong)PositionGetInteger(POSITION_MAGIC);
         string sym = PositionGetString(POSITION_SYMBOL);
         if(pmagic==MagicNumber && StringCompare(sym,_Symbol)==0) count++;
      }
   }
   return count;
}

bool HasOpenPosition()
{
   return (CountOurPositions() > 0);
}

bool GetFirstOurPositionInfo(ulong &ticket_out, long &type_out, double &volume_out, double &entry_out, double &profitPoints_out, double &profitMoney_out)
{
   ticket_out = 0;
   int total = PositionsTotal();
   for(int i=0;i<total;i++)
   {
      ulong ticket = PositionGetTicket(i);
      if(ticket==0) continue;
      if(PositionSelectByTicket(ticket))
      {
         ulong pmagic = (ulong)PositionGetInteger(POSITION_MAGIC);
         string sym = PositionGetString(POSITION_SYMBOL);
         if(pmagic==MagicNumber && StringCompare(sym,_Symbol)==0)
         {
            ticket_out = ticket;
            type_out = (long)PositionGetInteger(POSITION_TYPE);
            volume_out = PositionGetDouble(POSITION_VOLUME);
            entry_out = PositionGetDouble(POSITION_PRICE_OPEN);
            profitMoney_out = PositionGetDouble(POSITION_PROFIT);
            double bid = SymbolInfoDouble(_Symbol, SYMBOL_BID);
            double ask = SymbolInfoDouble(_Symbol, SYMBOL_ASK);
            if(type_out == POSITION_TYPE_BUY)
               profitPoints_out = (bid - entry_out) / _Point;
            else
               profitPoints_out = (entry_out - ask) / _Point;
            return true;
         }
      }
   }
   return false;
}

// -------------------- ManageOpenPositions (NEW FOLLOW MODE + OLD FEATURES) --------------------
void ManageOpenPositions()
{
   int total = PositionsTotal();
   if(total <= 0) return;

   double pointVal = _Point;
   long stops_level = (long)SymbolInfoInteger(_Symbol, SYMBOL_TRADE_STOPS_LEVEL);
   double spreadPoints = (SymbolInfoDouble(_Symbol,SYMBOL_ASK) - SymbolInfoDouble(_Symbol,SYMBOL_BID)) / _Point;
   
   TradeSignal currentSignal = GetSignal();

   // pip -> points conversion for FollowStartPips (old logic)
   int pipToPoints = (int)((int)SymbolInfoInteger(_Symbol,SYMBOL_DIGITS) > 3 ? 10 : 1);
   int configuredFollowStartPoints = FollowStartPoints;
   if(FollowStartPips > 0) configuredFollowStartPoints = FollowStartPips * pipToPoints;

   for(int i = total-1; i >= 0; i--)
   {
      ulong ticket = PositionGetTicket(i);
      if(ticket == 0) continue;
      if(!PositionSelectByTicket(ticket)) continue;

      ulong pmagic = (ulong)PositionGetInteger(POSITION_MAGIC);
      string sym = PositionGetString(POSITION_SYMBOL);
      if(pmagic != MagicNumber || StringCompare(sym,_Symbol) != 0) continue;

      long type = (long)PositionGetInteger(POSITION_TYPE);
      double entry = PositionGetDouble(POSITION_PRICE_OPEN);
      double volume = PositionGetDouble(POSITION_VOLUME);
      double currentSL = PositionGetDouble(POSITION_SL);
      double currentTP = PositionGetDouble(POSITION_TP);
      double bid = SymbolInfoDouble(_Symbol, SYMBOL_BID);
      double ask = SymbolInfoDouble(_Symbol, SYMBOL_ASK);
      int digits = (int)SymbolInfoInteger(_Symbol, SYMBOL_DIGITS);
      datetime openTime = (datetime)PositionGetInteger(POSITION_TIME);
      int secondsOpen = (int)(TimeCurrent() - openTime);
      double profitPoints = (type==POSITION_TYPE_BUY) ? (bid - entry) / _Point : (entry - ask) / _Point;
      double profitMoney = PositionGetDouble(POSITION_PROFIT);

      PrintFormat("📊 POS: #%I64u %s entry=%.5f SL=%.5f profit=%.1fpts (%.2f$)",
                  ticket, (type==POSITION_TYPE_BUY?"BUY":"SELL"), entry, currentSL, profitPoints, profitMoney);

      // 1) max hold time
      if(MaxHoldSeconds > 0 && secondsOpen >= MaxHoldSeconds)
      {
         PrintFormat("⏰ Closing pos=%I64u: MaxHoldSeconds exceeded", ticket);
         ClosePositionByTicket(ticket);
         continue;
      }

      // 2) close on opposite signal
      if(CloseOnOppositeSignal)
      {
         if((type==POSITION_TYPE_BUY && currentSignal==SELL) || (type==POSITION_TYPE_SELL && currentSignal==BUY))
         {
            PrintFormat("🔄 Closing pos=%I64u: Opposite signal", ticket);
            ClosePositionByTicket(ticket);
            continue;
         }
      }

      long stops_level_raw2 = (long)SymbolInfoInteger(_Symbol, SYMBOL_TRADE_STOPS_LEVEL);
      double stops_level_pts = (stops_level_raw2 > 0) ? (double)stops_level_raw2 : 0.0;
      double minMovePoints = MathMax(1, TrailingMinMovePoints);

      bool changedSL = false;
      double desiredSL = currentSL;

      // ===== NEW FOLLOW LOGIC (PRIORITAS TERTINGGI) =====
      if(UseNewFollowLogic)
      {
         // Rule 1: Ketika profit >= 50 points, pindahkan SL ke entry + 50 points
         if(profitPoints >= SLPlusAt50Points)
         {
            if(type == POSITION_TYPE_BUY)
            {
               double candidate = NormalizeDouble(entry + SLPlusAt50Points * _Point, digits);
               if(currentSL <= 0.0 || candidate > currentSL + MinMoveToUpdateSL * _Point)
               {
                  if((bid - candidate) / _Point >= stops_level_pts)
                  {
                     desiredSL = candidate;
                     changedSL = true;
                     PrintFormat("✅ SL+ pos=%I64u BUY entry+50pts=%.5f", ticket, desiredSL);
                  }
               }
            }
            else // SELL
            {
               double candidate = NormalizeDouble(entry - SLPlusAt50Points * _Point, digits);
               if(currentSL <= 0.0 || candidate < currentSL - MinMoveToUpdateSL * _Point)
               {
                  if((candidate - ask) / _Point >= stops_level_pts)
                  {
                     desiredSL = candidate;
                     changedSL = true;
                     PrintFormat("✅ SL+ pos=%I64u SELL entry-50pts=%.5f", ticket, desiredSL);
                  }
               }
            }
         }

         // Rule 2: Ketika profit >= 100 points, aktifkan follow mode (jarak 10 points dari market)
         if(profitPoints >= FollowEnableAt100)
         {
            if(type == POSITION_TYPE_BUY)
            {
               double candidate = NormalizeDouble(bid - FollowGap10Points * _Point, digits);
               if(currentSL <= 0.0 || candidate > currentSL + MinMoveToUpdateSL * _Point)
               {
                  if((bid - candidate) / _Point >= stops_level_pts)
                  {
                     desiredSL = candidate;
                     changedSL = true;
                     PrintFormat("🚀 FOLLOW pos=%I64u BUY bid-10pts=%.5f", ticket, desiredSL);
                  }
               }
            }
            else // SELL
            {
               double candidate = NormalizeDouble(ask + FollowGap10Points * _Point, digits);
               if(currentSL <= 0.0 || candidate < currentSL - MinMoveToUpdateSL * _Point)
               {
                  if((candidate - ask) / _Point >= stops_level_pts)
                  {
                     desiredSL = candidate;
                     changedSL = true;
                     PrintFormat("🚀 FOLLOW pos=%I64u SELL ask+10pts=%.5f", ticket, desiredSL);
                  }
               }
            }
         }
      }
      else
      {
         // ===== OLD LOGIC (Break-even, trailing, follow-mode lama) =====
         
         // 3) Break-even
         if(profitPoints >= BreakEvenBufferPoints)
         {
            double beSL = 0.0;
            if(type==POSITION_TYPE_BUY)
            {
               beSL = NormalizeDouble(entry + BreakEvenBufferPoints * _Point, digits);
               if(currentSL <= 0.0 || beSL > currentSL + minMovePoints * _Point)
               {
                  if((bid - beSL) / _Point >= stops_level_pts)
                  {
                     desiredSL = beSL;
                     changedSL = true;
                  }
               }
            }
            else
            {
               beSL = NormalizeDouble(entry - BreakEvenBufferPoints * _Point, digits);
               if(currentSL <= 0.0 || beSL < currentSL - minMovePoints * _Point)
               {
                  if((beSL - ask) / _Point >= stops_level_pts)
                  {
                     desiredSL = beSL;
                     changedSL = true;
                  }
               }
            }
         }

         // 4) OLD FOLLOW-MODE
         bool followActive = false;
         if(FollowStartMoney > 0.0)
         {
            if(profitMoney >= FollowStartMoney) followActive = true;
         }
         else
         {
            if(configuredFollowStartPoints > 0 && profitPoints >= configuredFollowStartPoints) followActive = true;
         }

         if(followActive)
         {
            if(type==POSITION_TYPE_BUY)
            {
               double candidate = NormalizeDouble(bid - FollowDistancePoints * _Point, digits);
               if(currentSL <= 0.0 || candidate > currentSL + FollowMinMovePoints * _Point)
               {
                  if((bid - candidate) / _Point >= stops_level_pts)
                  {
                     desiredSL = candidate;
                     changedSL = true;
                  }
               }
            }
            else
            {
               double candidate = NormalizeDouble(ask + FollowDistancePoints * _Point, digits);
               if(currentSL <= 0.0 || candidate < currentSL - FollowMinMovePoints * _Point)
               {
                  if((candidate - ask) / _Point >= stops_level_pts)
                  {
                     desiredSL = candidate;
                     changedSL = true;
                  }
               }
            }
         }
         else if(UseDynamicTrailing && profitPoints >= TrailingStartPoints)
         {
            // Dynamic trailing
            if(type==POSITION_TYPE_BUY)
            {
               double candidate = NormalizeDouble(bid - TrailingDistancePoints * _Point, digits);
               if(currentSL <= 0.0 || candidate > currentSL + minMovePoints * _Point)
               {
                  if((bid - candidate) / _Point >= stops_level_pts)
                  {
                     desiredSL = candidate;
                     changedSL = true;
                  }
               }
            }
            else
            {
               double candidate = NormalizeDouble(ask + TrailingDistancePoints * _Point, digits);
               if(currentSL <= 0.0 || candidate < currentSL - minMovePoints * _Point)
               {
                  if((candidate - ask) / _Point >= stops_level_pts)
                  {
                     desiredSL = candidate;
                     changedSL = true;
                  }
               }
            }
         }
      }

      // apply SL update
      if(changedSL && NormalizeDouble(desiredSL, digits) != NormalizeDouble(currentSL, digits))
      {
         MqlTradeRequest req;
         MqlTradeResult res;
         ZeroMemory(req);
         ZeroMemory(res);
         req.action = TRADE_ACTION_SLTP;
         req.position = ticket;
         req.symbol = _Symbol;
         req.sl = desiredSL;
         req.tp = currentTP;

         bool sent = OrderSend(req, res);
         if(sent && res.retcode == TRADE_RETCODE_DONE)
         {
            PrintFormat("✅ SL updated pos=%I64u newSL=%.5f", ticket, desiredSL);
         }
      }
   } // end for positions
}

// -------------------- AVERAGING (one-by-one with cooldown) --------------------
void ManageAveragingIfNeeded()
{
   if(!AveragingEnabled) return;
   if(!HasOpenPosition()) return;

   if(lastAveragingTime > 0 && (TimeCurrent() - lastAveragingTime) < AveragingCooldownSeconds)
   {
      return;
   }

   ulong ticket;
   long type;
   double vol, entry;
   double profitPoints, profitMoney;
   if(!GetFirstOurPositionInfo(ticket, type, vol, entry, profitPoints, profitMoney)) return;

   if(profitPoints <= -MathAbs(AveragingTriggerPoints))
   {
      int currentCount = CountOurPositions();
      int maxAllowed = MaxAveragingTrades + 1;
      if(currentCount >= maxAllowed) return;

      double addLot = CalculateAveragingLot(vol);
      if(addLot <= 0.0) return;

      TradeSignal sig = (type==POSITION_TYPE_BUY) ? BUY : SELL;
      PrintFormat("📈 Averaging: baseTicket=%I64u profitPts=%.1f addLot=%.2f", ticket, profitPoints, addLot);

      bool ok = ExecuteMarketOrder(sig, addLot, StopLossPoints, TakeProfitPoints);
      if(ok) lastAveragingTime = TimeCurrent();
   }
}

// -------------------- Close helper --------------------
bool ClosePositionByTicket(ulong ticket)
{
   if(!PositionSelectByTicket(ticket)) return false;
   long type = (long)PositionGetInteger(POSITION_TYPE);
   double volume = PositionGetDouble(POSITION_VOLUME);
   string symbol = PositionGetString(POSITION_SYMBOL);
   MqlTradeRequest req;
   MqlTradeResult  res;
   ZeroMemory(req);
   ZeroMemory(res);

   if(type == POSITION_TYPE_BUY)
   {
      req.action = TRADE_ACTION_DEAL;
      req.symbol = symbol;
      req.type   = ORDER_TYPE_SELL;
      req.volume = volume;
      req.price  = SymbolInfoDouble(symbol, SYMBOL_BID);
   }
   else if(type == POSITION_TYPE_SELL)
   {
      req.action = TRADE_ACTION_DEAL;
      req.symbol = symbol;
      req.type   = ORDER_TYPE_BUY;
      req.volume = volume;
      req.price  = SymbolInfoDouble(symbol, SYMBOL_ASK);
   }
   else return false;

   req.deviation = Slippage;
   req.magic = MagicNumber;
   req.position = ticket;
   bool sent = OrderSend(req, res);
   if(!sent || res.retcode != TRADE_RETCODE_DONE) return false;
   PrintFormat("❌ Position %I64u closed", ticket);
   return true;
}

// -------------------- OnTick flow --------------------
void OnTick()
{
   // 1) check closed deals
   CheckClosedDealsForLoss();

   // 2) manage open positions
   ManageOpenPositions();

   // 3) if positions exist, try averaging
   if(HasOpenPosition())
   {
      ManageAveragingIfNeeded();
      return;
   }

   // 4) Get signal
   TradeSignal sig = GetSignal();
   if(sig == NONE) return;

   // ✅ 5) ENTRY EVALUATION - Check if can open new position
   if(!CanOpenNewPosition(sig))
   {
      return; // Blocked by evaluation
   }

   // 6) Calculate lot
   double lot;
   
   if(UseProgressiveLot && currentProgressiveLot > 0.0)
   {
      lot = currentProgressiveLot;
      lot = NormalizeLotStep(lot);
      if(lot > MaxLot) lot = MaxLot;
      if(lot > MaxLotAbsolute) lot = MaxLotAbsolute;
      PrintFormat("💰 Using PROGRESSIVE LOT=%.2f", lot);
   }
   else if(pendingNextLotActive)
   {
      lot = pendingNextLot;
      lot = NormalizeLotStep(lot);
      if(lot > MaxLot) lot = MaxLot;
      if(lot > MaxLotAbsolute) lot = MaxLotAbsolute;
      PrintFormat("💰 Using pendingNextLot=%.2f", lot);
   }
   else
   {
      lot = CalculateLotWithMultiplier();
      PrintFormat("💰 Using calculated lot=%.2f", lot);
   }

   // 7) Execute order
   ExecuteMarketOrder(sig, lot, StopLossPoints, TakeProfitPoints);
}

// -------------------- Trade transaction logging --------------------
void OnTradeTransaction(const MqlTradeTransaction &trans,const MqlTradeRequest &request,const MqlTradeResult &result)
{
   if(trans.type == TRADE_TRANSACTION_DEAL_ADD)
   {
      PrintFormat("📋 Trade: type=%d order=%I64u result=%d", (int)trans.type, trans.order, (int)result.retcode);
   }
}
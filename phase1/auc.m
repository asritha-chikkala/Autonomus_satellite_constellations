%% Autonomous Satellite Constellation with Hungarian Algorithm + Ensemble Risk
clc; clear; close all;
rng(7);

%% screensize
scr      = get(groot,'ScreenSize');   
SW       = scr(3);                    
SH       = scr(4);                    
% Layout constants 
LIVE_H   = round(SH * 0.38);         
VIEWER_W = round(SW * 0.58);         
VIEWER_H = SH - LIVE_H;              
DASH_W   = SW - VIEWER_W;            
DASH_H   = SH - LIVE_H;             

% Window origins
LIVE_X   = 0;         LIVE_Y   = 0;
VIEWER_X = 0;         VIEWER_Y = LIVE_H;
DASH_X   = VIEWER_W;  DASH_Y   = LIVE_H;

%% 1 Inputs
fprintf('=== Autonomous Satellite Constellation Simulation ===\n\n');
NUM_TARGETS    = input('Enter number of targets: ');
NUM_SATELLITES = input('Enter total satellites: ');
NUM_SPARES     = input('Enter spare satellites: ');
if NUM_SPARES >= NUM_SATELLITES
    error('Spare satellites must be less than total.');
end
if (NUM_SATELLITES-NUM_SPARES) < NUM_TARGETS
    error('Active satellites must be >= number of targets.');
end
fprintf('\n=== Initial Battery Levels (0.0 to 1.0) ===\n');
battery = zeros(NUM_SATELLITES,1);
for i = 1:NUM_SATELLITES
    while true
        v = input(sprintf('  Battery for Satellite %d : ',i));
        if v>0 && v<=1, battery(i)=v; break;
        else, fprintf('  Invalid. Enter (0,1].\n'); end
    end
end

%% 2  Constants
COVERAGE_RADIUS        = 0.05;
FAILURE_COST_THRESHOLD = 0.65;
DRAIN_ACTIVE  = 0.0005;
DRAIN_SPARE   = 0.00005;
DRAIN_DONE    = 0.0002;
R_EARTH       = 6371e3;
RE             = 6371;
ORBIT_H_MIN   = 450e3;
ORBIT_H_MAX   = 800e3;
ALT_MIN_KM    = 500;
ALT_MAX_KM    = 800;
MAX_STEPS     = 800;
TIME_STEP     = 20;

% Ensemble risk weights 
RISK_WEIGHTS = struct(...
    'operational', 0.20, ...
    'battery', 0.15, ...
    'coverage', 0.15, ...
    'redundancy', 0.10, ...
    'predictive', 0.15, ...
    'temporal', 0.05, ...
    'critical', 0.10, ...
    'resilience', 0.05, ...
    'ml_ensemble', 0.05);

%% 3  Target names 
pool = {'Bangalore','Mumbai','New Delhi','Tokyo','London','Cape Town',...
        'Sydney','Moscow','Dubai','Beijing','New York','Rio',...
        'Paris','Berlin','Rome'};
targetNames = pool(1:min(NUM_TARGETS,numel(pool)));
for ex = numel(targetNames)+1:NUM_TARGETS
    targetNames{ex} = sprintf('Target%d',ex);
end

%% 4  Fixed orbital + Target geometry
rng(7);
sat_alt  = ALT_MIN_KM+(ALT_MAX_KM-ALT_MIN_KM)*rand(NUM_SATELLITES,1);
sat_inc  = 45+rand(NUM_SATELLITES,1)*30;
sat_raan = mod((0:NUM_SATELLITES-1)'*360/NUM_SATELLITES ...
               +rand(NUM_SATELLITES,1)*30,360);
sat_ta   = rand(NUM_SATELLITES,1)*360;
sat_sma  = R_EARTH+ORBIT_H_MIN+rand(NUM_SATELLITES,1)*(ORBIT_H_MAX-ORBIT_H_MIN);
gs_lat   = -60+120*rand(1,NUM_TARGETS);
gs_lon   = -180+360*rand(1,NUM_TARGETS);

% Generate random target priorities
target_priorities = rand(1, NUM_TARGETS);
target_priorities = target_priorities / sum(target_priorities);

%% 5  theme
BG  = [1 1 1];
BG2 = [0.95 0.95 0.95];
CYN = [0 0.6 0.8];
GRN = [0 0.6 0];
YEL = [0.8 0.5 0];
RED = [0.8 0 0];
WHT = [0 0 0];

%% 6  Control dashboard
FW = DASH_W;
FH = DASH_H;

hFig = uifigure('Name','Satellite Control Center',...
    'Position',[DASH_X DASH_Y FW FH],'Color',BG);
H_STATUSBAR = 22;
H_SPEEDROW  = 44;
H_CTRLBTNS  = 46;
H_CTRLLBL   = 22;
GAP         = 8;

yStatusBar = 0;
ySpeedRow  = H_STATUSBAR + GAP;
yCtrlBtns  = ySpeedRow  + H_SPEEDROW + GAP;
yCtrlLbl   = yCtrlBtns  + H_CTRLBTNS + 2;
BOTTOM_H   = yCtrlLbl   + H_CTRLLBL  + GAP + 4;  % total fixed bottom height

% status bar
hStepLabel = uilabel(hFig,'Position',[0 yStatusBar FW H_STATUSBAR],...
    'Text','Initialising...',...
    'FontColor',YEL,'BackgroundColor',[0.03 0.03 0.07],...
    'FontSize',8,'FontWeight','bold','HorizontalAlignment','center');

% speed slider
uilabel(hFig,'Position',[20 ySpeedRow 70 28],'Text','Speed:',...
    'FontColor',WHT,'BackgroundColor',BG,'FontSize',13,'FontWeight','bold');
sliderW = FW - 170;
hSpeedSlider = uislider(hFig,'Position',[98 ySpeedRow+14 sliderW 3],...
    'Limits',[1 20],'Value',1,'MajorTicks',1:4:20,'MinorTicks',[]);
hSpeedLabel  = uilabel(hFig,'Position',[98+sliderW+10 ySpeedRow 60 28],...
    'Text','1x','FontColor',GRN,'BackgroundColor',BG,...
    'FontSize',14,'FontWeight','bold');
hSpeedSlider.ValueChangingFcn = @(~,evt) ...
    set(hSpeedLabel,'Text',sprintf('%dx',max(1,round(evt.Value))));
hSpeedSlider.ValueChangedFcn  = @(src,~) doSetSpeed(hFig,src,hSpeedLabel);

% Control panel label + 4 buttons 
uilabel(hFig,'Position',[20 yCtrlLbl FW-40 H_CTRLLBL],'Text','CONTROL PANEL',...
    'FontColor',CYN,'BackgroundColor',BG,'FontSize',10,'FontWeight','bold');
bw = floor((FW-60)/4); gap = 4;
ctrlDefs = {[0.13 0.52 0.13],'▶ PLAY';
            [0.68 0.42 0.06],'⏸ PAUSE';
            [0.13 0.28 0.68],'▶▶ FWD';
            [0.62 0.13 0.13],'◀◀ BACK'};
for bi = 1:4
    btn = uibutton(hFig,'push',...
        'Position',[20+(bi-1)*(bw+gap) yCtrlBtns bw H_CTRLBTNS],...
        'Text',ctrlDefs{bi,2},...
        'BackgroundColor',ctrlDefs{bi,1},'FontColor',[1 1 1],...
        'FontSize',13,'FontWeight','bold');
    switch bi
        case 1, btn.ButtonPushedFcn=@(~,~)setappdata(hFig,'isPaused',false);
        case 2, btn.ButtonPushedFcn=@(~,~)setappdata(hFig,'isPaused',true);
        case 3, btn.ButtonPushedFcn=@(~,~)doStepFwd(hFig);
        case 4, btn.ButtonPushedFcn=@(~,~)doStepBwd(hFig);
    end
end


SCROLL_Y  = BOTTOM_H;              
SCROLL_H  = FH - SCROLL_Y;          

tblH          = NUM_SATELLITES*26 + 32;   
EVENT_LOG_H   = 180;
CONTENT_H     = 34 + 20+44 + 38+32 + 20+40 + 36+30 + 20+96 + 26 + ...
                22 + tblH + 6 + 26 + 22 + EVENT_LOG_H + 20;

CONTENT_H = max(CONTENT_H, SCROLL_H + 50);

hScroll = uipanel(hFig,...
    'Position',[0 SCROLL_Y FW SCROLL_H],...
    'BackgroundColor',BG,...
    'BorderType','none',...
    'Scrollable','on');

hInner = uipanel(hScroll,...
    'Position',[0 0 FW CONTENT_H],...
    'BackgroundColor',BG,...
    'BorderType','none');


y = CONTENT_H - 4;  

% Title bar
y = y - 34;
uilabel(hInner,'Position',[0 y FW 34],...
    'Text','   SATELLITE CONTROL CENTER',...
    'FontColor',[1 1 1],'BackgroundColor',[0.2 0.2 0.2],...
    'FontSize',16,'FontWeight','bold');
y = y - 24;

% Architecture Mode
uilabel(hInner,'Position',[20 y FW-40 20],'Text','ARCHITECTURE MODE',...
    'FontColor',CYN,'BackgroundColor',BG,'FontSize',10,'FontWeight','bold');
y = y - 44;
archDecentBtn  = uibutton(hInner,'push',...
    'Position',[round(FW/2)+8 y FW-round(FW/2)-28 38],...
    'Text','  DECENTRALIZED',...
    'BackgroundColor',[0.22 0.40 0.72],'FontColor',[1 1 1],...
    'FontSize',12,'FontWeight','bold');
archCentralBtn = uibutton(hInner,'push',...
    'Position',[20 y round(FW/2)-16 38],...
    'Text','  CENTRALIZED',...
    'BackgroundColor',[0.25 0.25 0.30],'FontColor',[1 1 1],...
    'FontSize',12,'FontWeight','bold');

% appdata state store
setappdata(hFig,'arch_mode',           0);
setappdata(hFig,'isPaused',            false);
setappdata(hFig,'stepForward',         false);
setappdata(hFig,'stepBackward',        false);
setappdata(hFig,'simSpeed',            1);
setappdata(hFig,'archSwitchRequested', false);
setappdata(hFig,'requestedMode',       0);

archDecentBtn.ButtonPushedFcn  = ...
    @(~,~) doSwitchArch(hFig,archDecentBtn, archCentralBtn,0);
archCentralBtn.ButtonPushedFcn = ...
    @(~,~) doSwitchArch(hFig,archCentralBtn,archDecentBtn, 1);
y = y - 32;

% Mission Time
uilabel(hInner,'Position',[20 y FW-40 20],'Text','MISSION TIME',...
    'FontColor',CYN,'BackgroundColor',BG,'FontSize',10,'FontWeight','bold');
y = y - 40;
hDateLabel = uilabel(hInner,'Position',[20 y FW-40 36],'Text','--',...
    'FontColor',GRN,'BackgroundColor',BG2,'FontSize',16,...
    'FontWeight','bold','HorizontalAlignment','center');
y = y - 30;

% System Status
uilabel(hInner,'Position',[20 y FW-40 20],'Text','SYSTEM STATUS',...
    'FontColor',CYN,'BackgroundColor',BG,'FontSize',10,'FontWeight','bold');
y = y - 96;
rowLbl = {'Active:','Spare:','Failed:'}; rowClr = {GRN,YEL,RED};
hStatVal = gobjects(3,1);
for ri = 1:3
    ry = y + 96 - ri*30;
    uilabel(hInner,'Position',[40 ry 200 26],'Text',rowLbl{ri},...
        'FontColor',WHT,'BackgroundColor',BG2,'FontSize',13);
    hStatVal(ri) = uilabel(hInner,'Position',[FW-130 ry 100 26],...
        'Text','0','FontColor',rowClr{ri},'BackgroundColor',BG2,...
        'FontSize',15,'FontWeight','bold','HorizontalAlignment','right');
end
hStatVal(1).Text = num2str(NUM_SATELLITES-NUM_SPARES);
hStatVal(2).Text = num2str(NUM_SPARES);
hStatVal(3).Text = '0';
y = y - 26;

% Satellite Table 
uilabel(hInner,'Position',[20 y FW-40 22],'Text','SATELLITE STATUS',...
    'FontColor',CYN,'BackgroundColor',BG,'FontSize',10,'FontWeight','bold');
y = y - tblH - 6;
tStatus = uitable(hInner,'Position',[20 y FW-40 tblH],...
    'ColumnName',{'ID','STATE','TARGET','BAT'},'RowName',[],...
    'ColumnWidth',{55,100,130,65},...
    'BackgroundColor',[BG;BG2],'ForegroundColor',WHT,...
    'FontSize',11,'FontName','Consolas');
y = y - 26;

% Event Log
uilabel(hInner,'Position',[20 y FW-40 22],'Text','EVENT LOG',...
    'FontColor',CYN,'BackgroundColor',BG,'FontSize',10,'FontWeight','bold');
y = y - EVENT_LOG_H - 4;
hEventBox = uitextarea(hInner,'Position',[20 y FW-40 EVENT_LOG_H],...
    'FontSize',9,'FontName','Consolas',...
    'BackgroundColor',BG2,'FontColor',WHT,...
    'Editable','off','Value',{'Simulation initialised...'});

%% 7 live stats window
hLive = uifigure('Name','Live Statistics',...
    'Position',[LIVE_X LIVE_Y SW LIVE_H]);
hLive.Color = BG;


margin  = 6;
nCols   = 4;
colW    = floor((SW - margin*(nCols+1)) / nCols);
plotH   = LIVE_H - 54;  
plotY   = margin + 4;

cx = zeros(1,nCols);
for ci = 1:nCols
    cx(ci) = margin + (ci-1)*(colW+margin);
end

% Pie Chart
axPie = uiaxes(hLive,'Position',[cx(1) plotY colW plotH]);
axPie.Color = BG; axPie.XColor = WHT; axPie.YColor = WHT;
axPie.GridColor = [0.8 0.8 0.8]; axPie.GridAlpha = 0.5;
grid(axPie,'on');
title(axPie,'Satellite States','Color',CYN,'FontSize',11,'FontWeight','bold');

% Coverage Progress
axCov = uiaxes(hLive,'Position',[cx(2) plotY colW plotH]);
axCov.Color = BG; axCov.XColor = WHT; axCov.YColor = WHT;
axCov.GridColor = [0.8 0.8 0.8]; axCov.GridAlpha = 0.5;
grid(axCov,'on'); hold(axCov,'on');
title(axCov,'Coverage Progress','Color',CYN,'FontSize',11,'FontWeight','bold');
ylabel(axCov,'Number of Targets (count)','Color',WHT,'FontSize',10);
xlabel(axCov,'Coverage Status','Color',WHT,'FontSize',10);
hBarCov = bar(axCov,[1 2],[0 NUM_TARGETS],'FaceColor','flat','BarWidth',0.55);
hBarCov.CData = [0.10 0.85 0.35; 0.85 0.20 0.20];
set(axCov,'XTick',[1 2],'XTickLabel',{'Covered','Remaining'},'FontSize',10);
ylim(axCov,[0 NUM_TARGETS+1]);

% Battery per Satellite
axBat = uiaxes(hLive,'Position',[cx(3) plotY colW plotH]);
axBat.Color = BG; axBat.XColor = WHT; axBat.YColor = WHT;
axBat.GridColor = [0.8 0.8 0.8]; axBat.GridAlpha = 0.5;
grid(axBat,'on'); hold(axBat,'on');
title(axBat,'Battery per Satellite  (colour = state)',...
    'Color',CYN,'FontSize',11,'FontWeight','bold');
xlabel(axBat,'Satellite ID','Color',WHT,'FontSize',10);
ylabel(axBat,'Battery Level (%)','Color',WHT,'FontSize',10);
hBatBar = bar(axBat,1:NUM_SATELLITES,battery*100,'FaceColor','flat');
hBatBar.CData = repmat([0.10 0.85 0.35],NUM_SATELLITES,1);
set(axBat,'XTick',1:NUM_SATELLITES,...
    'XTickLabel',arrayfun(@(x)sprintf('Sat%d',x),1:NUM_SATELLITES,...
    'UniformOutput',false),'FontSize',9);
ylim(axBat,[0 110]);

% Risk Component History
risk_history = zeros(MAX_STEPS, 10);

% Ensemble Risk Plot
axRisk = uiaxes(hLive,'Position',[cx(4) plotY colW plotH]);
axRisk.Color = BG; axRisk.XColor = WHT; axRisk.YColor = WHT;
axRisk.GridColor = [0.8 0.8 0.8]; axRisk.GridAlpha = 0.5;
grid(axRisk,'on'); hold(axRisk,'on');
title(axRisk,'Ensemble Risk & Components','Color',CYN,'FontSize',11,'FontWeight','bold');
xlabel(axRisk,'Mission Elapsed Time (s)','Color',WHT,'FontSize',10);
ylabel(axRisk,'Risk Index (0-1, dimensionless)','Color',WHT,'FontSize',10);
hRiskLine = plot(axRisk,NaN,NaN,'r-','LineWidth',2);
hRiskComponents = gobjects(1,9);
colors = lines(9);
for i = 1:9
    hRiskComponents(i) = plot(axRisk,NaN,NaN,'Color',colors(i,:),'LineWidth',1,'LineStyle','--');
end
yline(axRisk,FAILURE_COST_THRESHOLD,'y--','LineWidth',1.5);
legend(axRisk,{'Total','Op','Bat','Cov','Red','Pred','Temp','Crit','Res','ML'}, ...
    'TextColor',WHT,'Color',BG,'Location','eastoutside');
ylim(axRisk,[0 max(FAILURE_COST_THRESHOLD*2.5,1)]);
drawnow;

%% 8  simulation
arch_results  = {};
all_history   = {[],[]};
all_cost_hist = {[],[]};
all_risk_hist = {[],[]};
modes_to_run  = [0 1];
sats_last = {}; gs_last = {};
evBuf     = {};

% Initialize ensemble models
[rf_model, xgb_model, fuzzy_model] = initialize_ensemble_models();

for modeIdx = 1:2

    arch_mode = modes_to_run(modeIdx);
    modeStr   = getModeName(arch_mode);
    fprintf('\n>>> Starting %s mode with Auction + Ensemble Risk\n',modeStr);

    % highlight arch buttons
    if ishandle(hFig)
        if arch_mode==0
            archDecentBtn.BackgroundColor  = [0.22 0.40 0.72];
            archCentralBtn.BackgroundColor = [0.25 0.25 0.30];
        else
            archCentralBtn.BackgroundColor = [0.22 0.40 0.72];
            archDecentBtn.BackgroundColor  = [0.25 0.25 0.30];
        end
        setappdata(hFig,'arch_mode',           arch_mode);
        setappdata(hFig,'archSwitchRequested', false);
        setappdata(hFig,'isPaused',            false);
    end

    % fresh scenario
    t0 = datetime('now','TimeZone','UTC');
    sc = satelliteScenario(t0, t0+seconds(MAX_STEPS*TIME_STEP), TIME_STEP);
    sc.AutoSimulate = false;

    sats = cell(1,NUM_SATELLITES);
    gs   = cell(1,NUM_TARGETS);
    ac   = cell(NUM_SATELLITES,NUM_TARGETS);
    satPlot = zeros(NUM_SATELLITES,3);

    for i = 1:NUM_SATELLITES
        sma=sat_sma(i); inc=sat_inc(i); raan=sat_raan(i); ta=sat_ta(i);
        satPlot(i,:) = [sma inc raan];
        sats{i} = satellite(sc,sma,0,inc,raan,0,ta,'Name',sprintf('Sat%d',i));
        conicalSensor(sats{i},'MaxViewAngle',30);
    end
    for t = 1:NUM_TARGETS
        gs{t} = groundStation(sc,gs_lat(t),gs_lon(t),'Name',targetNames{t});
        gs{t}.MarkerSize = 10;
    end
    for i=1:NUM_SATELLITES
        for t=1:NUM_TARGETS, ac{i,t}=access(sats{i},gs{t}); end
    end
    sats_last = sats;  gs_last = gs;

    try; close(vObj); catch; end
    vObj = satelliteScenarioViewer(sc,'Dimension','3D',...
        'Basemap','satellite','ShowDetails',true);
    set(vObj,'CameraReferenceFrame','Inertial');
    pause(1); drawnow;
    try
        vObj.Parent.Position = [VIEWER_X VIEWER_Y VIEWER_W VIEWER_H];
    catch
    end

    allAx=findall(0,'Type','uiaxes'); viewAx=[];
    if ~isempty(allAx), viewAx=allAx(end); end
    if ~isempty(viewAx)
        hold(viewAx,'on');
        th=linspace(0,2*pi,400)'; sc_clr=lines(NUM_SATELLITES);
        for i=1:NUM_SATELLITES
            a=satPlot(i,1); ic=satPlot(i,2)*pi/180; rn=satPlot(i,3)*pi/180;
            xo=a*cos(th); yo=a*sin(th); zo=zeros(size(th));
            Rx=[1 0 0;0 cos(ic) -sin(ic);0 sin(ic) cos(ic)];
            Rz=[cos(rn) -sin(rn) 0;sin(rn) cos(rn) 0;0 0 1];
            xyz=(Rz*Rx)*[xo';yo';zo'];
            plot3(viewAx,xyz(1,:),xyz(2,:),xyz(3,:),...
                'Color',[sc_clr(i,:) 0.7],'LineWidth',1.5);
        end
        th2=linspace(0,2*pi,300)';
        for hh=[ORBIT_H_MIN ORBIT_H_MAX]
            plot3(viewAx,(R_EARTH+hh)*cos(th2),(R_EARTH+hh)*sin(th2),...
                zeros(300,1),'Color',[0.3 0.8 1 0.5],...
                'LineWidth',1.2,'LineStyle','--');
        end
        hold(viewAx,'off');
    end
    drawnow;

    % initial state
    cur_bat   = battery;
    cur_state = strings(NUM_SATELLITES,1);
    cur_task  = nan(NUM_SATELLITES,1);
    cur_owner = nan(1,NUM_TARGETS);
    for i=1:(NUM_SATELLITES-NUM_SPARES)
        cur_state(i)="ACTIVE";
        if i<=NUM_TARGETS, cur_task(i)=i; cur_owner(i)=i-1; end
    end
    for i=(NUM_SATELLITES-NUM_SPARES+1):NUM_SATELLITES
        cur_state(i)="SPARE";
    end
    covered  = false(1,NUM_TARGETS);
    step     = 0;  nR=0; nC=0;
    costHist = zeros(MAX_STEPS,1);
    history  = cell(1,MAX_STEPS);
    curDT = datetime('now','TimeZone','UTC');

    evBuf = {sprintf('=== %s mode started (Auction + Ensemble Risk) ===',modeStr)};
    appendEventLog(hEventBox,evBuf);  evBuf={};
    switchedEarly = false;

    %% Step loop
    while step<MAX_STEPS && ishandle(hFig)

        
        if getappdata(hFig,'archSwitchRequested')
            req = getappdata(hFig,'requestedMode');
            if req ~= arch_mode
                switchedEarly = true;
                modes_to_run(modeIdx+1:end) = req;
                setappdata(hFig,'archSwitchRequested',false);
                msg=sprintf('[SWITCH] %s interrupted step %d -> %s',...
                    modeStr,step,getModeName(req));
                appendEventLog(hEventBox,{msg});
                fprintf('%s\n',msg);
                break;
            end
            setappdata(hFig,'archSwitchRequested',false);
        end

        % pause / step control
        if getappdata(hFig,'isPaused')
            if getappdata(hFig,'stepForward')
                setappdata(hFig,'stepForward',false);
            elseif getappdata(hFig,'stepBackward')
                setappdata(hFig,'stepBackward',false);
                drawnow; pause(0.04); continue;
            else
                drawnow; pause(0.04); continue;
            end
        end

        % speed
        spd = getappdata(hFig,'simSpeed');
        for spd_k = 1:spd
            if step>=MAX_STEPS, break; end
            step    = step+1;

            % advance scenario safely
            try
                advance(sc);
            catch
                try
                    vObj = satelliteScenarioViewer(sc,'Dimension','3D',...
                        'Basemap','satellite','ShowDetails',true);
                    set(vObj,'CameraReferenceFrame','Inertial');
                    try; vObj.Parent.Position=[VIEWER_X VIEWER_Y VIEWER_W VIEWER_H]; catch; end
                    advance(sc);
                catch
                    sc.AutoSimulate = false;
                    try; advance(sc); catch; end
                end
            end

            curDT   = curDT+seconds(TIME_STEP);

            % ECEF positions
            posECEF = zeros(3,NUM_SATELLITES);
            for i=1:NUM_SATELLITES
                tmp=states(sats{i},'CoordinateFrame','ecef');
                posECEF(:,i)=tmp(1:3,1);
            end

            % energy drain
            for i=1:NUM_SATELLITES
                if cur_state(i)=="FAILED", cur_bat(i)=0; continue; end
                switch cur_state(i)
                    case "ACTIVE", d=DRAIN_ACTIVE;
                    case "SPARE",  d=DRAIN_SPARE;
                    case "DONE",   d=DRAIN_DONE;
                    otherwise,     d=0;
                end
                cur_bat(i)=max(0,cur_bat(i)-d);
                if cur_bat(i)<=0
                    cur_state(i)="FAILED";
                    evBuf{end+1}=sprintf('Sat%d FAILED (battery)',i);
                    if ~isnan(cur_task(i))
                        cur_owner(cur_task(i))=NaN; cur_task(i)=NaN;
                    end
                end
            end

            % coverage check
            for i=1:NUM_SATELLITES
                if cur_state(i)=="FAILED"||cur_state(i)=="DONE"||isnan(cur_task(i))
                    continue;
                end
                t=cur_task(i);
                intvls=accessIntervals(ac{i,t});
                hit=~isempty(intvls);
                if ~hit
                    posT=gsPosECEF(gs_lat(t),gs_lon(t));
                    hit=norm(posECEF(:,i)-posT)/(2*R_EARTH)<COVERAGE_RADIUS;
                end
                if hit
                    covered(t)=true; cur_state(i)="DONE";
                    evBuf{end+1}=sprintf('Sat%d covered %s',i,targetNames{t});
                end
            end

            % predictive failure
            for i=1:NUM_SATELLITES
                if cur_state(i)~="ACTIVE"||isnan(cur_task(i)), continue; end
                t=cur_task(i);
                posT=gsPosECEF(gs_lat(t),gs_lon(t));
                dn=norm(posECEF(:,i)-posT)/(2*R_EARTH);
                if 0.7*dn+0.3*(1-cur_bat(i))>FAILURE_COST_THRESHOLD
                    cur_state(i)="FAILED"; cur_owner(t)=NaN; cur_task(i)=NaN;
                    evBuf{end+1}=sprintf('Sat%d PRED-FAIL->%s',i,targetNames{t});
                end
            end

            %% TASK ASSIGNMENT - AUCTION ALGORITHM
            uncov = find(isnan(cur_owner) & ~covered);
            if ~isempty(uncov)
                avail_sats = find((cur_state == "SPARE" | cur_state == "DONE") & cur_state ~= "FAILED");

                if ~isempty(avail_sats) && ~isempty(uncov)
                    % Build value matrix: value(a,u) = 1 - cost(a,u)
                    % so satellites bid for the highest-value (lowest-cost) target
                    nA = length(avail_sats);
                    nU = length(uncov);
                    value_matrix = zeros(nA, nU);
                    for a = 1:nA
                        sat_idx = avail_sats(a);
                        for u = 1:nU
                            tgt_idx = uncov(u);
                            posT = gsPosECEF(gs_lat(tgt_idx), gs_lon(tgt_idx));
                            distance_cost = 0.7 * norm(posECEF(:, sat_idx) - posT) / (2*R_EARTH);
                            battery_cost  = 0.3 * (1 - cur_bat(sat_idx));
                            value_matrix(a, u) = 1 - (distance_cost + battery_cost);
                        end
                    end

                    [raw_assignments, ~] = auction(value_matrix);

                    for a = 1:nA
                        if raw_assignments(a) > 0 && raw_assignments(a) <= nU
                            sat_idx = avail_sats(a);
                            tgt_idx = uncov(raw_assignments(a));
                            cur_task(sat_idx)  = tgt_idx;
                            cur_state(sat_idx) = "ACTIVE";
                            cur_owner(tgt_idx) = sat_idx - 1;
                            nR = nR + 1;
                            nC = nC + 1;
                            if arch_mode == 1
                                evBuf{end+1} = sprintf('[C-Auction] Sat%d->%s', sat_idx, targetNames{tgt_idx});
                            else
                                evBuf{end+1} = sprintf('[D-Auction] Sat%d->%s', sat_idx, targetNames{tgt_idx});
                            end
                        end
                    end
                end
            end

            %% ENSEMBLE RISK CALCULATION
            [system_risk, risk_components, ml_confidence] = ensemble_risk_calculation(...
                cur_state, cur_bat, cur_task, covered, posECEF, gs_lat, gs_lon, ...
                target_priorities, step, MAX_STEPS, FAILURE_COST_THRESHOLD, R_EARTH, ...
                rf_model, xgb_model, fuzzy_model);

            costHist(step) = system_risk;
            risk_components_array = struct2array(risk_components);
            risk_history(step, 1:9) = risk_components_array;
            risk_history(step, 10) = system_risk;

            history{step}=struct('battery',cur_bat,'sat_state',cur_state,...
                'sat_task',cur_task,'target_owner',cur_owner,...
                'covered',covered,'step',step,'arch_mode',arch_mode,...
                'reassign',nR,'comm',nC,'curDT',curDT, ...
                'risk_components', risk_components, ...
                'ml_confidence', ml_confidence);

            if all(covered), break; end

            if mod(step, 100) == 0 && step > 0
                [rf_model, xgb_model, fuzzy_model] = update_ensemble_models(...
                    rf_model, xgb_model, fuzzy_model, risk_history(1:step,:), step);
            end

        end 

       
        na=sum(cur_state=="ACTIVE"); ns=sum(cur_state=="SPARE");
        nd=sum(cur_state=="DONE");   nf=sum(cur_state=="FAILED");
        nc=sum(covered);

        for i=1:NUM_SATELLITES, updSat(sats{i},cur_state(i)); end
        for t2=1:NUM_TARGETS
            own=cur_owner(t2);
            if covered(t2),   gs{t2}.MarkerColor=[0.6 0.1 1];
            elseif isnan(own),gs{t2}.MarkerColor=[1 0.45 0];
            else,             gs{t2}.MarkerColor=[0 0.9 0.3];
            end
        end

        if ishandle(hLive)
            doLiveUpdate(axPie,hBarCov,hBatBar,...
                na,ns,nd,nf,nc,NUM_TARGETS,...
                cur_bat,cur_state,NUM_SATELLITES,...
                risk_history,step,CYN,FAILURE_COST_THRESHOLD, ...
                hRiskLine, hRiskComponents, WHT);
        end

        if ishandle(hFig)
            hStatVal(1).Text=num2str(na);
            hStatVal(2).Text=num2str(ns);
            hStatVal(3).Text=num2str(nf);
            hDateLabel.Text=datestr(curDT,'dd-mmm-yyyy HH:MM:SS');
            tStatus.Data=mkTableData(NUM_SATELLITES,...
                cur_state,cur_task,cur_bat,targetNames);
            if ~isempty(evBuf)
                appendEventLog(hEventBox,evBuf); evBuf={};
            end
            alive=cur_state~="FAILED"; avgB=0;
            if any(alive), avgB=mean(cur_bat(alive))*100; end
            hStepLabel.Text=sprintf(...
                'Step:%d/%d  A:%d S:%d D:%d F:%d  Cov:%d/%d  Bat:%.0f%%  Risk:%.2f [%s-Ensemble]',...
                step,MAX_STEPS,na,ns,nd,nf,nc,NUM_TARGETS,avgB,system_risk,modeStr);
        end
        drawnow;

        if all(covered)
            msg=sprintf('ALL %d TARGETS COVERED at step %d',NUM_TARGETS,step);
            appendEventLog(hEventBox,{msg}); fprintf('%s\n',msg); break;
        end
    end 

    
    res.mode=modeStr; res.steps=step;
    res.energy_used=sum(battery)-sum(cur_bat);
    res.reassignments=nR; res.communication=nC;
    arch_results{modeIdx}=res;
    all_history{modeIdx}=history(1:step);
    all_cost_hist{modeIdx}=costHist(1:step);
    all_risk_hist{modeIdx}=risk_history(1:step,:);
    fprintf('%s done with Auction+Ensemble: %d steps E=%.3f R=%d C=%d\n',...
        modeStr,step,res.energy_used,nR,nC);

    if ishandle(hFig)
        if switchedEarly
            hStepLabel.Text=sprintf('[%s-Ensemble] interrupted step %d — switching...',...
                modeStr,step);
        else
            hStepLabel.Text=sprintf('[%s-Ensemble] COMPLETE (%d steps) — next mode...',...
                modeStr,step);
        end
        hStepLabel.FontColor=[0.3 0.6 0.3];
        setappdata(hFig,'isPaused',true);
    end
    appendEventLog(hEventBox,{sprintf('=== %s COMPLETE with Ensemble Risk (%d steps) ===',modeStr,step)});
    pause(1.5);

end

%% 
if numel(arch_results)==2 && ~isempty(arch_results{1}) && ~isempty(arch_results{2})
    dr=arch_results{1}; cr=arch_results{2};
    cmpW = round(SW * 0.80);
    cmpH = round(SH * 0.72);
    cmpX = round((SW - cmpW) / 2);
    cmpY = round((SH - cmpH) / 2);
    figure('Name','Architecture Comparison with Ensemble Risk',...
        'Position',[cmpX cmpY cmpW cmpH],'Color','w');
    ttls={'Steps to Completion','Total Energy Consumption',...
          'Task Assignment Count','Communication Cost', ...
          'Avg Risk Level', 'Peak Risk Level'};
    ylbs={'Duration (s)',...
          'Energy Consumed (fraction, initial - final battery)',...
          'Number of Assignments (count)',...
          'Number of Messages (count)', ...
          'Average Risk Index (0-1)', ...
          'Maximum Risk Index (0-1)'};

    dv=[dr.steps*TIME_STEP dr.energy_used dr.reassignments dr.communication ...
        mean(all_risk_hist{1}(:,10)) max(all_risk_hist{1}(:,10))];
    cv=[cr.steps*TIME_STEP cr.energy_used cr.reassignments cr.communication ...
        mean(all_risk_hist{2}(:,10)) max(all_risk_hist{2}(:,10))];

    cC=[0.30 0.47 0.78]; cD=[0.80 0.50 0.27];
    for mi=1:6
        subplot(2,3,mi);
        bd=[cv(mi) dv(mi)];
        b=bar(bd,0.55,'FaceColor','flat');
        b.CData(1,:)=cC; b.CData(2,:)=cD;
        set(gca,'XTickLabel',{'Centralized','Decentralized'},...
            'FontSize',12,'FontWeight','bold','Box','off');
        title(ttls{mi},'FontSize',13,'FontWeight','bold');
        ylabel(ylbs{mi},'FontSize',10);
        grid on; box off;
        for k=1:2
            text(k,bd(k),sprintf('%.4g',bd(k)),...
                'HorizontalAlignment','center','VerticalAlignment','bottom',...
                'FontSize',12,'FontWeight','bold');
        end
        mx=max(bd)*1.25; if mx>0, ylim([0 mx]); end
    end
    sgtitle('Ensemble Risk: Centralized vs Decentralized Performance',...
        'FontSize',14,'FontWeight','bold');
end

%% 10  Final report
li=find(~cellfun(@isempty,all_history),1,'last');
lHist=all_history{li}; lCost=all_cost_hist{li}; lRisk=all_risk_hist{li}; nSt=numel(lHist);
if nSt>0
    fS=lHist{nSt};
    bH=zeros(nSt,NUM_SATELLITES); cH=zeros(nSt,1); rH=lCost;
    for s=1:nSt
        bH(s,:)=lHist{s}.battery'*100; cH(s)=sum(lHist{s}.covered);
    end
    nA=sum(fS.sat_state=="ACTIVE"); nSp=sum(fS.sat_state=="SPARE");
    nD=sum(fS.sat_state=="DONE");   nF2=sum(fS.sat_state=="FAILED");

    rpW = round(SW * 0.92);
    rpH = round(SH * 0.88);
    rpX = round((SW - rpW) / 2);
    rpY = round((SH - rpH) / 2);
    figure('Name','Final Simulation Report - Ensemble Risk','Color','w',...
        'Position',[rpX rpY rpW rpH]);

    % Time vector in seconds
    tSec = (1:nSt) * TIME_STEP;

    % Battery History
    ax1=subplot(2,3,1); hold(ax1,'on');
    title(ax1,'Battery History','FontWeight','bold');
    xlabel(ax1,'Mission Elapsed Time (s)'); ylabel(ax1,'Battery Level (%)');
    cl=lines(NUM_SATELLITES);
    for i=1:NUM_SATELLITES
        plot(ax1,tSec,bH(:,i),'Color',[cl(i,:) 0.85],'LineWidth',1.2,...
            'DisplayName',sprintf('Sat%d',i));
    end
    lg=legend(ax1,'Location','southwest','FontSize',7);
    ylim(ax1,[0 105]);

    % Coverage Progress
    ax2=subplot(2,3,2); hold(ax2,'on');
    title(ax2,'Coverage Progress','FontWeight','bold');
    xlabel(ax2,'Mission Elapsed Time (s)'); ylabel(ax2,'Number of Targets Covered (count)');
    area(ax2,tSec,cH,'FaceColor',[0.2 0.7 0.3],'FaceAlpha',0.5,...
        'EdgeColor',[0.3 0.9 0.4]);
    yline(ax2,NUM_TARGETS,'k--','LineWidth',1.5); ylim(ax2,[0 NUM_TARGETS+1]);

    % Ensemble Risk Over Time
    ax3=subplot(2,3,3); hold(ax3,'on');
    title(ax3,'Ensemble Risk Over Time','FontWeight','bold');
    xlabel(ax3,'Mission Elapsed Time (s)'); ylabel(ax3,'Risk Index (0-1, dimensionless)');
    plot(ax3,tSec,lRisk(1:nSt,10),'r-','LineWidth',2);
    yline(ax3,FAILURE_COST_THRESHOLD,'y--','LineWidth',1.5);

    % Risk Components
    ax3b = subplot(2,3,4); hold(ax3b,'on');
    title(ax3b,'Risk Components','FontWeight','bold');
    xlabel(ax3b,'Mission Elapsed Time (s)'); ylabel(ax3b,'Risk Component Contribution (0-1)');
    comp_names = {'Op','Bat','Cov','Red','Pred','Temp','Crit','Res','ML'};
    for i = 1:9
        plot(ax3b,tSec,lRisk(1:nSt,i),'Color',colors(i,:),'LineWidth',1.2);
    end
    legend(ax3b, comp_names, 'Location', 'eastoutside');

    % Final Battery
    ax4=subplot(2,3,5); hold(ax4,'on');
    title(ax4,'Final Battery per Satellite','FontWeight','bold');
    xlabel(ax4,'Satellite ID'); ylabel(ax4,'Remaining Battery Level (%)');
    bbar=bar(ax4,1:NUM_SATELLITES,fS.battery*100,'FaceColor','flat');
    bbar.CData=satColors(fS.sat_state,NUM_SATELLITES);
    ylim(ax4,[0 105]);
    set(ax4,'XTick',1:NUM_SATELLITES,...
        'XTickLabel',arrayfun(@(x)sprintf('Sat%d',x),1:NUM_SATELLITES,...
        'UniformOutput',false),'XTickLabelRotation',45);

    % Summary Report
    ax6=subplot(2,3,6);
    axis(ax6,'off');
    title(ax6,'Ensemble Risk Summary','Color','b','FontWeight','bold');
    ss=sprintf(['  Steps:        %d\n  Duration:     %.1f min\n\n'...
      '  Covered:      %d/%d  (%.0f%%)\n\n'...
      '  Active Sats:  %d/%d\n  Spare Sats:   %d/%d\n'...
      '  Done Sats:    %d/%d\n  Failed Sats:  %d/%d\n\n'...
      '  Avg Battery:  %.1f%%\n\n'...
      '  Avg Risk:     %.3f\n  Peak Risk:    %.3f\n'...
      '  Risk < Thresh: %.0f%% of time\n\n'...
      '  Mode:         %s\n  Assignment:   Auction\n  Risk Model:   Ensemble'],...
      nSt,nSt*TIME_STEP/60,...
      sum(fS.covered),NUM_TARGETS,100*sum(fS.covered)/max(NUM_TARGETS,1),...
      nA,NUM_SATELLITES,nSp,NUM_SATELLITES,...
      nD,NUM_SATELLITES,nF2,NUM_SATELLITES,...
      mean(fS.battery)*100,...
      mean(lRisk(1:nSt,10)),max(lRisk(1:nSt,10)),...
      100*sum(lRisk(1:nSt,10) < FAILURE_COST_THRESHOLD)/nSt,...
      getModeName(fS.arch_mode));
    text(ax6,0.02,0.97,ss,'Units','normalized','VerticalAlignment','top',...
        'FontName','Courier','FontSize',10,'Color','b');
    sgtitle('CONSTELLATION SIMULATION — ENSEMBLE RISK FINAL REPORT',...
        'FontSize',14,'FontWeight','bold');
end

%% 11  playback
if ishandle(hFig)
    hStepLabel.Text='COMPLETE — ▶ replay  ▶▶/◀◀ step';
    hStepLabel.FontColor=[0.3 0.6 0.3];
    setappdata(hFig,'isPaused',true);
end
pbHist=lHist; pbCost=lCost; pbRisk=lRisk; pbTotal=numel(pbHist); pbStep=1;

while ishandle(hFig)
    paused=getappdata(hFig,'isPaused');
    fwd=getappdata(hFig,'stepForward');
    bwd=getappdata(hFig,'stepBackward');
    spd_pb=getappdata(hFig,'simSpeed');

    if bwd && pbStep>1
        pbStep=pbStep-1; setappdata(hFig,'stepBackward',false);
    end
    if ~paused||fwd
        setappdata(hFig,'stepForward',false);
        pbStep=min(pbStep+spd_pb,pbTotal);
        if pbStep>=pbTotal, setappdata(hFig,'isPaused',true); end
    end

    st=pbHist{min(pbStep,pbTotal)};
    for i=1:NUM_SATELLITES, updSat(sats_last{i},st.sat_state(i)); end
    for t=1:NUM_TARGETS
        own=st.target_owner(t);
        if st.covered(t),  gs_last{t}.MarkerColor=[0.6 0.1 1];
        elseif isnan(own), gs_last{t}.MarkerColor=[1 0.45 0];
        else,              gs_last{t}.MarkerColor=[0 0.9 0.3];
        end
    end

    na=sum(st.sat_state=="ACTIVE"); ns=sum(st.sat_state=="SPARE");
    nd=sum(st.sat_state=="DONE");   nf=sum(st.sat_state=="FAILED");
    nc=sum(st.covered);
    pbC=zeros(pbStep,1);
    for s=1:min(pbStep,numel(pbCost)), pbC(s)=pbCost(s); end

    if ishandle(hFig)
        hStatVal(1).Text=num2str(na); hStatVal(2).Text=num2str(ns);
        hStatVal(3).Text=num2str(nf);
        hDateLabel.Text=datestr(st.curDT,'dd-mmm-yyyy HH:MM:SS');
        tStatus.Data=mkTableData(NUM_SATELLITES,...
            st.sat_state,st.sat_task,st.battery,targetNames);
        alive=st.sat_state~="FAILED"; avgB=0;
        if any(alive), avgB=mean(st.battery(alive))*100; end
        hStepLabel.Text=sprintf(...
            'PLAYBACK %d/%d  A:%d S:%d D:%d F:%d  Cov:%d/%d  Bat:%.0f%%  Risk:%.2f [%s-Ensemble]',...
            pbStep,pbTotal,na,ns,nd,nf,nc,NUM_TARGETS,avgB,...
            pbCost(pbStep), getModeName(st.arch_mode));
    end
    if ishandle(hLive)
        doLiveUpdate(axPie,hBarCov,hBatBar,...
            na,ns,nd,nf,nc,NUM_TARGETS,...
            st.battery,st.sat_state,NUM_SATELLITES,...
            pbRisk,min(pbStep,size(pbRisk,1)),CYN,FAILURE_COST_THRESHOLD, ...
            hRiskLine, hRiskComponents, WHT);
    end
    drawnow limitrate; pause(0.03);
end
fprintf('Playback complete.\n');

%% ENSEMBLE RISK FUNCTIONS

function [rf_model, xgb_model, fuzzy_model] = initialize_ensemble_models()
    rf_model = struct();
    rf_model.weights = rand(8,1);
    rf_model.bias = 0.1;
    rf_model.trained = false;

    xgb_model = struct();
    xgb_model.learning_rate = 0.1;
    xgb_model.max_depth = 3;
    xgb_model.n_estimators = 10;
    xgb_model.trained = false;

    fuzzy_model = struct();
    fuzzy_model.rules = {
        'IF battery IS low AND distance IS far THEN risk IS high',
        'IF battery IS high AND distance IS close THEN risk IS low',
        'IF coverage IS poor AND redundancy IS low THEN risk IS high'
    };
    fuzzy_model.membership = struct();
    fuzzy_model.trained = false;
end

function [rf_model, xgb_model, fuzzy_model] = update_ensemble_models(...
    rf_model, xgb_model, fuzzy_model, risk_history, step)
    if step > 100
        rf_model.trained = true;
        xgb_model.trained = true;
        fuzzy_model.trained = true;
    end
end

function [ensemble_risk, risk_components, ml_confidence] = ensemble_risk_calculation(...
    cur_state, cur_bat, cur_task, covered, posECEF, gs_lat, gs_lon, ...
    target_priorities, step, MAX_STEPS, FAILURE_COST_THRESHOLD, R_EARTH, ...
    rf_model, xgb_model, fuzzy_model)

    NUM_SATELLITES = length(cur_bat);
    NUM_TARGETS = length(gs_lat);
    risk_components = struct();

    operational_risk = 0; active_count = 0;
    for i = 1:NUM_SATELLITES
        if cur_state(i) == "ACTIVE" && ~isnan(cur_task(i))
            t = cur_task(i);
            posT = gsPosECEF(gs_lat(t), gs_lon(t));
            operational_risk = operational_risk + ...
                0.7 * norm(posECEF(:,i) - posT) / (2*R_EARTH) + ...
                0.3 * (1 - cur_bat(i));
            active_count = active_count + 1;
        end
    end
    risk_components.operational = operational_risk / max(active_count, 1);

    battery_risk = 0; critical_threshold = 0.2;
    for i = 1:NUM_SATELLITES
        if cur_state(i) ~= "FAILED"
            if cur_bat(i) < critical_threshold
                battery_risk = battery_risk + exp(-cur_bat(i)/critical_threshold) - 1;
            end
        end
    end
    risk_components.battery = battery_risk / NUM_SATELLITES;

    uncovered_targets = sum(~covered);
    if uncovered_targets > 0
        coverage_risk = (uncovered_targets / NUM_TARGETS)^2;
    else
        coverage_risk = 0;
    end
    risk_components.coverage = coverage_risk;

    target_coverage = zeros(1, NUM_TARGETS);
    for i = 1:NUM_SATELLITES
        if ~isnan(cur_task(i))
            target_coverage(cur_task(i)) = target_coverage(cur_task(i)) + 1;
        end
    end
    optimal_coverage = 2;
    redundancy_risk = mean(abs(target_coverage - optimal_coverage)) / optimal_coverage;
    risk_components.redundancy = min(redundancy_risk, 1);

    predictive_risk = 0; predictive_count = 0;
    for i = 1:NUM_SATELLITES
        if cur_state(i) == "ACTIVE" && ~isnan(cur_task(i))
            t = cur_task(i);
            posT = gsPosECEF(gs_lat(t), gs_lon(t));
            dn = norm(posECEF(:,i) - posT) / (2*R_EARTH);
            failure_metric = 0.7 * dn + 0.3 * (1 - cur_bat(i));
            if failure_metric > FAILURE_COST_THRESHOLD * 0.8
                predictive_risk = predictive_risk + ...
                    (failure_metric - FAILURE_COST_THRESHOLD * 0.8) / ...
                    (FAILURE_COST_THRESHOLD * 0.2);
                predictive_count = predictive_count + 1;
            end
        end
    end
    risk_components.predictive = predictive_risk / max(predictive_count, 1);

    risk_components.temporal = (step / MAX_STEPS)^1.5;

    critical_risk = 0;
    for t = 1:NUM_TARGETS
        if ~covered(t), critical_risk = critical_risk + target_priorities(t); end
    end
    risk_components.critical = critical_risk;

    spare_count  = sum(cur_state == "SPARE");
    failed_count = sum(cur_state == "FAILED");
    if failed_count > 0
        resilience_risk = failed_count / (spare_count + failed_count + 1);
    else
        resilience_risk = 0;
    end
    risk_components.resilience = resilience_risk;

    ml_risk = 0; ml_confidence = 0.5;
    if rf_model.trained && xgb_model.trained && fuzzy_model.trained
        features = [risk_components.operational, risk_components.battery, ...
                    risk_components.coverage, risk_components.redundancy, ...
                    risk_components.predictive, risk_components.temporal, ...
                    risk_components.critical, risk_components.resilience];
        rf_pred   = sum(features .* rf_model.weights') + rf_model.bias;
        xgb_pred  = mean(features) * xgb_model.learning_rate;
        fuzzy_pred = mean([features(1)>0.7, features(2)>0.5, ...
                           features(3)>0.3, features(4)>0.4]);
        ml_weights = [0.4, 0.3, 0.3];
        ml_risk    = ml_weights(1)*rf_pred + ml_weights(2)*xgb_pred + ml_weights(3)*fuzzy_pred;
        predictions   = [rf_pred, xgb_pred, fuzzy_pred];
        ml_confidence = 1 - (std(predictions) / (mean(predictions) + eps));
        ml_confidence = min(max(ml_confidence, 0), 1);
    end
    risk_components.ml_ensemble = ml_risk;

    if step < MAX_STEPS * 0.3
        weights = [0.15, 0.10, 0.20, 0.10, 0.10, 0.05, 0.15, 0.05, 0.10];
    elseif step < MAX_STEPS * 0.7
        weights = [0.18, 0.12, 0.15, 0.10, 0.15, 0.05, 0.10, 0.05, 0.10];
    else
        weights = [0.10, 0.20, 0.10, 0.05, 0.20, 0.10, 0.05, 0.10, 0.10];
    end
    risk_values = [risk_components.operational, risk_components.battery, ...
                   risk_components.coverage, risk_components.redundancy, ...
                   risk_components.predictive, risk_components.temporal, ...
                   risk_components.critical, risk_components.resilience, ...
                   risk_components.ml_ensemble];
    ensemble_risk = min(max(sum(risk_values .* weights), 0), 1);
end

%% AUCTION ALGORITHM
% Bertsekas auction algorithm for assignment.
% value_matrix(i,j) = value agent i gets from being assigned to object j.
% Maximises total value (equivalent to minimising total cost).
% Returns assignments(i) = j meaning agent i is assigned to object j,
% or 0 if agent i is unassigned (only possible when nAgents > nObjects).

function [assignments, total_value] = auction(value_matrix)
    [nAgents, nObjects] = size(value_matrix);
    orig_nA = nAgents;
    orig_nO = nObjects;

    % Pad to square if needed
    if nAgents > nObjects
        value_matrix = [value_matrix, -inf(nAgents, nAgents - nObjects)];
        nObjects = nAgents;
    elseif nObjects > nAgents
        value_matrix = [value_matrix; -inf(nObjects - nAgents, nObjects)];
        nAgents = nObjects;
    end

    % Epsilon-scaling for convergence (Bertsekas)
    epsilon    = 1 / (nAgents + 1);
    prices     = zeros(1, nObjects);   % object prices
    assignment = zeros(1, nAgents);    % assignment(i) = object assigned to agent i (0 = none)
    obj_owner  = zeros(1, nObjects);   % obj_owner(j) = agent owning object j (0 = none)

    unassigned = 1:nAgents;

    max_iter = nAgents * nObjects * 10 + 100;
    iter = 0;

    while ~isempty(unassigned) && iter < max_iter
        iter = iter + 1;
        i = unassigned(1);

        % Compute net value for each object: value - price
        net_vals = value_matrix(i, :) - prices;

        % Best and second-best object
        [sorted_vals, sorted_idx] = sort(net_vals, 'descend');
        best_j   = sorted_idx(1);
        best_val = sorted_vals(1);

        if nObjects > 1
            second_val = sorted_vals(2);
        else
            second_val = -inf;
        end

        % Bid increment
        bid_increment = best_val - second_val + epsilon;

        % Raise price of best object
        prices(best_j) = prices(best_j) + bid_increment;

        % Evict current owner of best_j if any
        prev_owner = obj_owner(best_j);
        if prev_owner > 0
            assignment(prev_owner) = 0;
            unassigned(end+1) = prev_owner; %#ok<AGROW>
        end

        % Assign agent i to best_j
        assignment(i) = best_j;
        obj_owner(best_j) = i;

        % Remove i from unassigned list
        unassigned(1) = [];
    end

    % Build output: restrict to original dimensions
    assignments = zeros(1, orig_nA);
    for i = 1:orig_nA
        j = assignment(i);
        if j > 0 && j <= orig_nO
            assignments(i) = j;
        end
    end

    % Total value of the assignment
    total_value = 0;
    for i = 1:orig_nA
        if assignments(i) > 0
            total_value = total_value + value_matrix(i, assignments(i));
        end
    end
end

%%
function updSat(sat_obj,stateStr)
    switch stateStr
        case "ACTIVE", c=[0.00 0.90 0.00];
        case "SPARE",  c=[0.00 0.70 1.00];
        case "DONE",   c=[0.70 0.10 1.00];
        case "FAILED", c=[1.00 0.10 0.10];
        otherwise,     c=[0.50 0.50 0.50];
    end
    sat_obj.MarkerColor=c;
end

function bc=satColors(sat_state,N)
    bc=zeros(N,3);
    for i=1:N
        switch sat_state(i)
            case "ACTIVE",  bc(i,:)=[0.00 0.85 0.00];
            case "SPARE",   bc(i,:)=[0.00 0.65 1.00];
            case "DONE",    bc(i,:)=[0.70 0.10 1.00];
            case "FAILED",  bc(i,:)=[1.00 0.10 0.10];
            otherwise,      bc(i,:)=[0.50 0.50 0.50];
        end
    end
end

function data=mkTableData(N,sat_state,sat_task,bat,tgtNames)
    data=cell(N,4);
    for i=1:N
        tStr='-';
        if ~isnan(sat_task(i))
            nm=tgtNames{sat_task(i)}; tStr=nm(1:min(9,numel(nm)));
        end
        data{i,1}=sprintf('S%d',i-1); data{i,2}=char(sat_state(i));
        data{i,3}=tStr; data{i,4}=sprintf('%d%%',round(bat(i)*100));
    end
end

function appendEventLog(hBox,newLines)
    if isempty(newLines), return; end
    cur=hBox.Value;
    if ischar(cur), cur={cur}; end
    for k=1:numel(newLines)
        ln=newLines{k};
        if ~ischar(ln), ln=char(ln); end
        cur{end+1}=ln;
    end
    if numel(cur)>300, cur=cur(end-299:end); end
    hBox.Value=cur;
    try, scroll(hBox,'bottom'); catch; end
end

function name=getModeName(mode)
    if mode==1, name='CENTRALIZED'; else, name='DECENTRALIZED'; end
end

function doSwitchArch(hFig,pressedBtn,otherBtn,targetMode)
    pressedBtn.BackgroundColor=[0.22 0.40 0.72];
    otherBtn.BackgroundColor  =[0.25 0.25 0.30];
    if getappdata(hFig,'arch_mode')~=targetMode
        setappdata(hFig,'archSwitchRequested',true);
        setappdata(hFig,'requestedMode',      targetMode);
        setappdata(hFig,'arch_mode',          targetMode);
    end
end

function doStepFwd(hFig)
    setappdata(hFig,'isPaused',   true);
    setappdata(hFig,'stepForward',true);
end

function doStepBwd(hFig)
    setappdata(hFig,'isPaused',    true);
    setappdata(hFig,'stepBackward',true);
end

function doSetSpeed(hFig,src,lbl)
    spd=max(1,round(src.Value));
    src.Value=spd;
    setappdata(hFig,'simSpeed',spd);
    lbl.Text=sprintf('%dx',spd);
end

function doLiveUpdate(axPie, hBarCov, hBatBar, ...
        na, ns, nd, nf, nc, nTgt, bat, sat_state, N, ...
        risk_history, step, CYN, thresh, hRiskLine, hRiskComponents, textColor)

    pv = max([na ns nd nf], 0.001);
    pl = {sprintf('Active(%d)',na), sprintf('Spare(%d)',ns), ...
          sprintf('Done(%d)',nd),   sprintf('Failed(%d)',nf)};
    cla(axPie);
    pie(axPie, pv, pl);
    colormap(axPie, [0 0.85 0; 0 0.65 1; 0.7 0.1 1; 1 0.1 0]);
    title(axPie, 'Satellite States', 'Color', CYN, 'FontSize', 11, 'FontWeight', 'bold');
    kids = get(axPie, 'Children');
    for k = 1:numel(kids)
        if strcmp(get(kids(k), 'Type'), 'text')
            set(kids(k), 'Color', textColor, 'FontSize', 9, 'FontWeight', 'bold');
        end
    end

    set(hBarCov, 'YData', [nc max(nTgt-nc, 0)]);
    set(hBatBar, 'YData', bat'*100);
    hBatBar.CData = satColors(sat_state, N);

    if step >= 1
        set(hRiskLine, 'XData', (1:step)*20, 'YData', risk_history(1:step, 10));
        for i = 1:9
            set(hRiskComponents(i), 'XData', (1:step)*20, 'YData', risk_history(1:step, i));
        end
    end
end

function posE=gsPosECEF(lat_deg,lon_deg)
    lat=double(lat_deg(1))*pi/180; lon=double(lon_deg(1))*pi/180;
    R=6371e3;
    posE=R*[cos(lat)*cos(lon);cos(lat)*sin(lon);sin(lat)];
end

function [r_eci,v_eci]=keplerian2eci(a,e,i_deg,Om_deg,w_deg,nu_deg)
    mu=398600.5;
    ir=deg2rad(i_deg); Or=deg2rad(Om_deg);
    wr=deg2rad(w_deg); nr=deg2rad(nu_deg);
    rn=a*(1-e^2)/(1+e*cos(nr));
    rp=rn*[cos(nr);sin(nr);0];
    p=a*(1-e^2);
    vp=[sqrt(mu/p)*e*sin(nr);sqrt(mu/p)*(1+e*cos(nr));0];
    R3O=[cos(Or) -sin(Or) 0;sin(Or) cos(Or) 0;0 0 1];
    R1i=[1 0 0;0 cos(ir) -sin(ir);0 sin(ir) cos(ir)];
    R3w=[cos(wr) -sin(wr) 0;sin(wr) cos(wr) 0;0 0 1];
    R=R3O*R1i*R3w;
    r_eci=(R*rp)'; v_eci=(R*vp)';
end